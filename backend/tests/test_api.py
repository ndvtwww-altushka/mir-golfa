import os
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient
import app.db as db
from app.main import app


class ApiFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        db.DB_PATH = Path(cls.temp.name) / "test.sqlite3"
        os.environ["GOLF_ADMIN_TOKEN"] = "test-only-secret"
        cls.client = TestClient(app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        cls.temp.cleanup()
        os.environ.pop("GOLF_ADMIN_TOKEN", None)

    def test_elapsed_events_not_returned_as_upcoming(self):
        response = self.client.get("/api/v1/tournaments", params={"start_from": "2026-11-19", "q": "Кубок России"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["items"], [])

    def test_club_directory_uses_regulation_sourced_locations(self):
        response = self.client.get("/api/v1/clubs")
        self.assertEqual(response.status_code, 200)
        seeded = [club for club in response.json()["items"] if club["id"] in {"golf-na-skladochnoy", "playground-skladochnaya"}]
        self.assertEqual(len(seeded), 2)
        self.assertTrue(all(club["evidence_state"] == "verified" and club["source_url"] and club["source_excerpt"] for club in seeded))

    def test_current_regulation_feed_has_five_stages_and_evidence(self):
        response = self.client.get("/api/v1/tournaments", params={"start_from": "2026-11-19", "region": "Москва"})
        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]
        self.assertEqual(len(items), 5)
        self.assertTrue(all("Зимний кубок" in item["name"] for item in items))
        self.assertTrue(all(item["entry_fee_text"] and item["eligibility_notes"] for item in items))
        detail = self.client.get("/api/v1/tournaments/forest-hills-winter-cup-2026-stage-1").json()
        self.assertGreaterEqual(len(detail["evidence"]), 10)
        self.assertEqual(detail["source_authority"], "organizer")

    def test_recommendations_warn_when_eligibility_is_not_structured(self):
        response = self.client.get("/api/v1/recommendations", params={
            "region": "Москва", "age_group": "взрослые", "handicap": 24.5,
        })
        self.assertEqual(response.status_code, 200)
        matches = [item for item in response.json()["items"] if "Зимний кубок" in item["name"]]
        self.assertTrue(matches)
        self.assertTrue(all(item["eligibility_match"] == "check_regulations" for item in matches))

    def test_archive_preserves_unconfirmed_status(self):
        response = self.client.get("/api/v1/tournaments", params={"ended_before": "2026-11-19", "limit": 100})
        self.assertEqual(response.status_code, 200)
        items = response.json()["items"]
        # Календарь АГР наполняет архив целиком: важно не количество, а честный статус.
        self.assertGreaterEqual(len(items), 2)
        self.assertTrue(all(i["display_status"] == "date_elapsed_status_unconfirmed" for i in items))

    def test_public_submission_requires_admin_review(self):
        payload = {
            "event_name": "Тестовый турнир",
            "start_date": "2027-05-01",
            "end_date": "2027-05-02",
            "country": "Россия",
            "region": "Москва",
            "source_url": "https://example.org/event",
        }
        submitted = self.client.post("/api/v1/organizer/submissions", json=payload)
        self.assertEqual(submitted.status_code, 202)
        submission_id = submitted.json()["id"]
        self.assertEqual(submitted.json()["review_status"], "pending")

        unauthorized = self.client.get("/api/v1/admin/submissions")
        self.assertEqual(unauthorized.status_code, 401)

        approved = self.client.post(
            f"/api/v1/admin/submissions/{submission_id}/approve",
            headers={"X-Admin-Token": "test-only-secret"}, json={}
        )
        self.assertEqual(approved.status_code, 200)
        event_id = approved.json()["id"]
        detail = self.client.get(f"/api/v1/tournaments/{event_id}")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.json()["event_status"], "scheduled")

    def test_correction_is_reviewed_and_logged(self):
        payload = {
            "event_name": "Тест для исправления", "start_date": "2027-06-01", "end_date": "2027-06-02",
            "country": "Россия", "source_url": "https://example.org/correction-test",
        }
        submission = self.client.post("/api/v1/organizer/submissions", json=payload).json()
        approved = self.client.post(
            f"/api/v1/admin/submissions/{submission['id']}/approve",
            headers={"X-Admin-Token": "test-only-secret"}, json={}
        ).json()
        event_id = approved["id"]
        correction = self.client.post(f"/api/v1/tournaments/{event_id}/corrections", json={
            "field_name": "venue", "suggested_value": "Проверенное поле",
            "evidence_url": "https://example.org/official", "notes": "Проверить по объявлению",
        })
        self.assertEqual(correction.status_code, 202)
        report_id = correction.json()["id"]
        reviewed = self.client.post(
            f"/api/v1/admin/corrections/{report_id}/approve",
            headers={"X-Admin-Token": "test-only-secret"}, json={}
        )
        self.assertEqual(reviewed.status_code, 200)
        detail = self.client.get(f"/api/v1/tournaments/{event_id}").json()
        self.assertEqual(detail["venue"], "Проверенное поле")
        history = self.client.get(f"/api/v1/tournaments/{event_id}/history").json()
        self.assertEqual(history["count"], 1)

    def test_admin_can_publish_verified_result_and_club(self):
        submission = self.client.post("/api/v1/organizer/submissions", json={
            "event_name": "Турнир для протокола", "start_date": "2027-07-01", "end_date": "2027-07-02",
            "country": "Россия", "source_url": "https://example.org/result-event",
        }).json()
        event = self.client.post(
            f"/api/v1/admin/submissions/{submission['id']}/approve",
            headers={"X-Admin-Token": "test-only-secret"}, json={}
        ).json()
        headers = {"X-Admin-Token": "test-only-secret"}
        result = self.client.post(f"/api/v1/admin/tournaments/{event['id']}/results", headers=headers, json={
            "participant_name": "Иван Игрок", "category": "Мужчины", "place": 1,
            "gross_score": "72", "source_url": "https://example.org/protocol.pdf",
            "verified_excerpt": "Итоговый протокол: 1 место — Иван Игрок.",
        })
        self.assertEqual(result.status_code, 201)
        public_results = self.client.get(f"/api/v1/tournaments/{event['id']}/results").json()
        self.assertEqual(public_results["count"], 1)
        club = self.client.post("/api/v1/admin/clubs", headers=headers, json={
            "name": "Тестовый клуб", "country": "Россия", "region": "Москва",
            "source_url": "https://example.org/club", "verified_excerpt": "Контакты клуба.",
        })
        self.assertEqual(club.status_code, 201)
        self.assertEqual(self.client.get("/api/v1/clubs", params={"q": "Тестовый клуб"}).json()["count"], 1)

    def test_calendar_ics_has_content_type(self):
        response = self.client.get("/api/v1/calendar.ics")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/calendar", response.headers["content-type"])


if __name__ == "__main__":
    unittest.main()

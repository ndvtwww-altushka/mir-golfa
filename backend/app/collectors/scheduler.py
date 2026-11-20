"""Daily source monitor. Install APScheduler and run as a separate worker process."""
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from .monitor import run_once


def main() -> None:
    scheduler = BlockingScheduler(timezone="Europe/Moscow")
    scheduler.add_job(run_once, CronTrigger(hour=6, minute=0), id="source-monitor",
                      replace_existing=True, max_instances=1, coalesce=True)
    run_once()  # initial check at process start, not tomorrow morning
    scheduler.start()


if __name__ == "__main__":
    main()

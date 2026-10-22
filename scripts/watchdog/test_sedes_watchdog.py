"""python3 -m unittest discover -s scripts/watchdog"""

import json
import unittest

from sedes_watchdog import compose, compose_disk, decide, decide_disk, describe_health_failure

CONFIG = {
    "WATCHDOG_TARGET_NAME": "SEDES produção",
    "WATCHDOG_URL": "https://sedes.oca-portal.com/api/health",
    "WATCHDOG_WATCHER": "a VM do beta (LSD)",
}


def run(results, failures_before_alert=2, reminder_minutes=0):
    """Passa uma sequência de verificações (uma por minuto) e junta os e-mails."""
    state, sent = {}, []
    for minute, (ok, key) in enumerate(results):
        state, kind = decide(
            state, ok, "problema", key, minute * 60.0, failures_before_alert, reminder_minutes
        )
        if kind:
            sent.append((minute, kind))
    return sent


class DecideTest(unittest.TestCase):
    def test_a_deploy_blip_does_not_send_email(self):
        self.assertEqual(run([(True, ""), (False, "down"), (True, "")]), [])

    def test_alerts_after_the_threshold_and_again_when_it_comes_back(self):
        sent = run([(False, "down"), (False, "down"), (False, "down"), (True, "")])
        self.assertEqual(sent, [(1, "down"), (3, "recovered")])

    def test_warns_when_what_is_failing_changes(self):
        sent = run([(False, "deps:gee"), (False, "deps:gee"), (False, "deps:gee,smtp")])
        self.assertEqual(sent, [(1, "down"), (2, "changed")])

    def test_reminds_only_when_asked(self):
        results = [(False, "down")] * 8
        self.assertEqual(run(results), [(1, "down")])
        self.assertEqual(
            run(results, reminder_minutes=3), [(1, "down"), (4, "reminder"), (7, "reminder")]
        )


def run_disk(percents, minutes_apart=1):
    """Passa uma sequência de leituras do disco e junta os e-mails."""
    state, sent = {}, []
    for index, percent in enumerate(percents):
        state, kind = decide_disk(state, percent, index * minutes_apart * 60.0)
        if kind:
            sent.append((index, kind))
    return sent


class DecideDiskTest(unittest.TestCase):
    def test_alerts_once_when_it_crosses_the_limit_and_when_it_goes_down(self):
        self.assertEqual(
            run_disk([50, 86, 90, 84, 86, 79]), [(1, "disk_full"), (5, "disk_ok")]
        )

    def test_reminds_once_a_day_while_it_stays_full(self):
        sent = run_disk([90, 90, 90, 90], minutes_apart=12 * 60)
        self.assertEqual(sent, [(0, "disk_full"), (2, "disk_reminder")])


class DescribeTest(unittest.TestCase):
    def test_names_the_dependencies_that_failed(self):
        body = json.dumps(
            {
                "status": "fail",
                "dependencies": {
                    "gee": {"ok": False, "error": "timeout"},
                    "contentful": {"ok": True},
                    "smtp": {"ok": False, "error": "not configured"},
                },
            }
        ).encode()
        problem, key = describe_health_failure(503, body)
        self.assertEqual(key, "deps:gee,smtp")
        self.assertIn("Earth Engine não respondeu a tempo", problem)
        self.assertIn("envio de e-mail (SMTP) está sem credencial", problem)

    def test_any_other_answer_means_the_site_is_down(self):
        self.assertEqual(describe_health_failure(502, b"<html>Bad Gateway</html>")[1], "down")
        self.assertEqual(describe_health_failure(503, b"<html>nginx</html>")[1], "down")


class ComposeTest(unittest.TestCase):
    def test_recovery_says_for_how_long_it_was_down(self):
        subject, body = compose(
            "recovered", {"first_failure_at": 0.0}, CONFIG, 95 * 60.0
        )
        self.assertEqual(subject, "[SEDES produção] voltou ao ar")
        self.assertIn("por 1 h 35 min", body)

    def test_disk_alert_names_the_vm_and_the_free_space(self):
        subject, body = compose_disk("disk_full", 87.4, 6_200_000_000, CONFIG)
        self.assertEqual(subject, "[SEDES] disco quase cheio na VM do beta (LSD)")
        self.assertIn("87% usado; restam 6.2 GB", body)


if __name__ == "__main__":
    unittest.main()

"""The identification loop, driven through whole sides with a fake clock and a scripted recogniser.

Each test is one the spec's §Pi listener "Identification loop" asks for: the silence gate, first
match fast, the two-in-a-row rule, the run-out timeout, the alive heartbeat, failing vs no match.
"""

from now_spinning.loop import (
    ALIVE_EVERY_S,
    GAP_AFTER_S,
    NO_MATCH_STOP_S,
    RECHECK_S,
    SLOW_RETRY_S,
    STOPPED_AFTER_S,
    Failed,
    Loop,
    NoMatch,
)
from now_spinning.recognition import CLIP_S, Match

MUSIC, SILENCE = -30.0, -96.0
A = Match(title="Enjoy the Silence", artist="Depeche Mode", shazam_id="1")
B = Match(title="Policy of Truth", artist="Depeche Mode", shazam_id="2")
C = Match(title="Blue Monday", artist="New Order", shazam_id="3")


class Evening:
    """Feed one reading a second; answer each clip with `answer(t)` after `delay` seconds."""

    def __init__(self, answer, delay=3):
        self.lp, self.answer, self.delay = Loop(), answer, delay
        self.posts: list[tuple[int, dict]] = []
        self.clips: list[int] = []
        self.pending: list[tuple[int, int, object]] = []
        self.t = 0
        self.posts += [(0, e) for e in self.lp.set_gate(0, True)]

    def play(self, seconds, dbfs):
        for _ in range(seconds):
            t = self.t
            for due, epoch, result in [p for p in self.pending if p[0] <= t]:
                self.pending.remove((due, epoch, result))
                self.posts += [(t, e) for e in self.lp.on_result(t, epoch, result)]
            events, clip = self.lp.on_level(t, dbfs)
            self.posts += [(t, e) for e in events]
            if clip is not None:
                self.clips.append(t)
                self.pending.append((t + self.delay, clip.epoch, self.answer(t)))
            self.t += 1
        return self

    def kinds(self, include_alive=False):
        return [e["event"] if e["event"] != "track" else e["title"] for _, e in self.posts if include_alive or e["event"] != "alive"]


def test_first_match_fast():
    ev = Evening(lambda t: A).play(40, MUSIC)
    assert ev.clips[0] == CLIP_S  # a clip as soon as there are 12 s of sound
    t, first = next((t, e) for t, e in ev.posts if e["event"] == "track")
    assert first["title"] == A.title and t <= 30  # the screen changes within about 30 s
    assert first == {"event": "track", "artist": A.artist, "title": A.title, "shazamId": "1"}


def test_then_slow_down_to_every_30_seconds():
    ev = Evening(lambda t: A).play(300, MUSIC)
    gaps = [b - a for a, b in zip(ev.clips[1:], ev.clips[2:])]
    assert gaps and all(RECHECK_S <= g <= RECHECK_S + 4 for g in gaps)
    assert ev.kinds() == [A.title]  # the same song again posts nothing new


def test_alive_every_minute_while_a_song_shows():
    ev = Evening(lambda t: A).play(400, MUSIC)
    alive = [t for t, e in ev.posts if e["event"] == "alive"]
    assert len(alive) >= 5 and all(b - a <= ALIVE_EVERY_S + 1 for a, b in zip(alive, alive[1:]))


def test_gap_once_after_4_seconds_of_silence_and_new_song_posts_at_once():
    answers = {True: A, False: B}
    ev = Evening(lambda t: answers[t < 200])
    ev.play(180, MUSIC).play(8, SILENCE).play(60, MUSIC)
    assert ev.kinds() == [A.title, "gap", B.title]
    gap_t = next(t for t, e in ev.posts if e["event"] == "gap")
    assert gap_t == 180 + GAP_AFTER_S
    b_t = next(t for t, e in ev.posts if e.get("title") == B.title)
    assert b_t <= 188 + CLIP_S + 4  # right after the gap: one clip, no second opinion needed


def test_a_short_dip_is_not_a_gap():
    ev = Evening(lambda t: A).play(100, MUSIC).play(3, SILENCE).play(100, MUSIC)
    assert ev.kinds() == [A.title]


def test_replacing_a_song_needs_two_results_that_agree():
    # Segue with no gap: A, then from 200 s Shazam says C once (a stray), then B for good.
    def answer(t):
        if t < 200:
            return A
        if t < 215:
            return C
        return B

    ev = Evening(answer).play(400, MUSIC)
    assert ev.kinds() == [A.title, B.title]  # the single C never shows


def test_three_misses_then_unmatched_once():
    ev = Evening(lambda t: NoMatch()).play(200, MUSIC)
    assert ev.kinds() == ["unmatched"]


def test_unknown_record_stops_after_five_minutes_then_retries_every_two():
    ev = Evening(lambda t: NoMatch()).play(NO_MATCH_STOP_S + 400, MUSIC)
    assert ev.kinds() == ["unmatched", "stopped"]
    stop_t = next(t for t, e in ev.posts if e["event"] == "stopped")
    assert stop_t == NO_MATCH_STOP_S
    later = [c for c in ev.clips if c > stop_t]
    assert later and all(b - a >= SLOW_RETRY_S for a, b in zip(later, later[1:]))
    assert not any(e["event"] == "alive" for t, e in ev.posts if t > stop_t)  # idle: no heartbeat


def test_after_stopping_a_match_still_shows():
    ev = Evening(lambda t: NoMatch() if t < 500 else A).play(800, MUSIC)
    assert ev.kinds() == ["unmatched", "stopped", A.title]


def test_three_minutes_of_silence_stops():
    ev = Evening(lambda t: A).play(100, MUSIC).play(STOPPED_AFTER_S + 10, SILENCE)
    assert ev.kinds() == [A.title, "gap", "stopped"]
    stop_t = next(t for t, e in ev.posts if e["event"] == "stopped")
    assert stop_t == 100 + STOPPED_AFTER_S


def test_run_out_groove_reads_as_silence_and_stops():
    # The run-out measured −52 dBFS (Phase 0 check 3): below −50, so it is silence here.
    ev = Evening(lambda t: A).play(100, MUSIC).play(STOPPED_AFTER_S + 10, -52.0)
    assert ev.kinds() == [A.title, "gap", "stopped"]


def test_a_result_from_before_a_gap_is_dropped():
    # The clip is taken at 12 s, the answer comes back after the music stopped: don't show it.
    ev = Evening(lambda t: A, delay=8).play(14, MUSIC).play(30, SILENCE)
    assert ev.kinds() == []


def test_errors_are_not_misses_and_three_mean_failing():
    ev = Evening(lambda t: Failed()).play(200, MUSIC)
    assert ev.kinds() == []  # no "unmatched": the recogniser failed, nothing was "not found"
    assert ev.lp.failing


def test_a_good_answer_clears_failing():
    ev = Evening(lambda t: Failed() if t < 150 else A).play(300, MUSIC)
    assert not ev.lp.failing and ev.kinds() == [A.title]


def test_closing_the_gate_posts_stopped_and_resets():
    ev = Evening(lambda t: A).play(100, MUSIC)
    assert ev.lp.set_gate(100, False) == [{"event": "stopped"}]
    assert ev.lp.on_level(101, MUSIC) == ([], None)  # not listening
    assert ev.lp.set_gate(102, False) == []


def test_closing_the_gate_with_nothing_shown_posts_nothing():
    lp = Loop()
    lp.set_gate(0, True)
    assert lp.set_gate(5, False) == []


def test_an_audio_outage_doesnt_count_as_silence_and_resumes_afresh():
    ev = Evening(lambda t: A).play(100, MUSIC)
    ev.lp.audio_resumed()  # readings stopped at 100 and come back at 400
    ev.t = 400
    ev.play(30, MUSIC)
    assert "gap" not in ev.kinds() and "stopped" not in ev.kinds()
    assert ev.kinds() == [A.title, A.title]  # posted again, from what was heard after the outage


def test_a_dropped_post_is_resent_at_the_next_reading():
    """QA on #726: after a `track` post is dropped, `alive` alone leaves the Worker idle."""
    ev = Evening(lambda t: A).play(40, MUSIC)
    ev.lp.resync()  # what the service does when an event is dropped after its retries
    ev.play(1, MUSIC)
    assert [e for t, e in ev.posts if t == ev.t - 1] == [A.event()]


def test_after_an_audio_outage_the_song_is_posted_afresh():
    """The Worker went idle during a 5-minute outage; the record still plays."""
    ev = Evening(lambda t: A).play(40, MUSIC)
    ev.lp.audio_resumed()
    ev.t = 340
    ev.play(30, MUSIC)
    after = [(t, e) for t, e in ev.posts if t >= 340 and e["event"] != "alive"]
    assert after and after[0][1] == A.event() and after[0][0] <= 340 + CLIP_S + 4


def test_a_shazam_outage_mid_record_doesnt_say_stopped():
    ev = Evening(lambda t: A if t < 60 else Failed()).play(60 + NO_MATCH_STOP_S + 300, MUSIC)
    assert ev.kinds() == [A.title] and ev.lp.failing


def test_a_track_body_fits_the_worker_limit_in_any_script():
    import json

    m = Match(title="長" * 300, artist="名" * 300, album="盤" * 300, artwork_url="https://x/" + "y" * 990, isrc="I" * 12, shazam_id="1")
    body = m.event()
    from now_spinning.recognition import body_size

    assert body_size(body) <= 2048 and body["title"] and body["artist"]
    assert len(json.dumps(body, ensure_ascii=False).encode()) == body_size(body)

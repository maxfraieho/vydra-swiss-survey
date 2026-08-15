"""Human behavior simulation module for automated Swiss-panel survey filling.

Reads agent/behavior/human_profile.json to simulate realistic human interactions:
- Smooth Bezier mouse movement trajectories with overshoot and acceleration curves.
- Natural typing delays with uniform/jitter distribution (30-80ms mean, >5ms std dev).
- Human pause distributions before/after interacting with fields and reading pages.
"""
from __future__ import annotations

import json
import math
import os
import random
import time
from typing import Any

DEFAULT_PROFILE: dict[str, Any] = {
    "typing": {
        "cps_mean": 4.2,
        "cps_jitter": 1.6,
        "mistake_rate": 0.03,
        "backspace_delay_ms": [120, 340],
        "min_delay_ms": 30,
        "max_delay_ms": 80,
    },
    "pause": {
        "before_field_ms": [400, 1800],
        "after_field_ms": [250, 900],
        "read_page_ms": [1200, 4000],
    },
    "mouse": {
        "path": "bezier",
        "overshoot_px": [2, 14],
        "settle_ms": [60, 180],
    },
    "scroll": {
        "steps": [3, 9],
        "step_px": [80, 260],
        "step_delay_ms": [90, 400],
    },
    "idle": {
        "micro_pause_prob": 0.18,
        "micro_pause_ms": [700, 2600],
    },
}

_CACHED_PROFILE: dict[str, Any] | None = None
_LAST_MOUSE_POS: tuple[float, float] = (400.0, 300.0)


def load_human_profile(path: str | None = None) -> dict[str, Any]:
    """Loads human behavior configuration from agent/behavior/human_profile.json."""
    global _CACHED_PROFILE
    if _CACHED_PROFILE is not None and path is None:
        return _CACHED_PROFILE

    profile_path = path or os.path.join(
        os.path.dirname(__file__), "agent", "behavior", "human_profile.json"
    )

    merged = dict(DEFAULT_PROFILE)
    if os.path.exists(profile_path):
        try:
            with open(profile_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    for k, v in data.items():
                        if isinstance(v, dict) and k in merged:
                            merged[k].update(v)
                        else:
                            merged[k] = v
        except Exception:
            pass

    if path is None:
        _CACHED_PROFILE = merged
    return merged


def generate_bezier_trajectory(
    start: tuple[float, float],
    end: tuple[float, float],
    steps: int = 25,
    overshoot_range: tuple[float, float] | list[float] = (2.0, 14.0),
) -> list[tuple[float, float]]:
    """Generates a list of (x, y) coordinates forming a cubic Bezier curve with overshoot."""
    x0, y0 = float(start[0]), float(start[1])
    x1, y1 = float(end[0]), float(end[1])
    dx = x1 - x0
    dy = y1 - y0
    dist = math.hypot(dx, dy)

    if dist < 3.0:
        return [(round(x0, 2), round(y0, 2)), (round(x1, 2), round(y1, 2))]

    # Unit direction and normal vector for lateral arc
    ux = dx / dist
    uy = dy / dist
    perp_x = -uy
    perp_y = ux

    # Random arc curvature
    arc_direction = random.choice([-1.0, 1.0])
    arc_factor1 = random.uniform(0.12, 0.32) * dist * arc_direction
    arc_factor2 = random.uniform(0.06, 0.22) * dist * arc_direction

    # Target overshoot magnitude
    min_os, max_os = float(overshoot_range[0]), float(overshoot_range[1])
    overshoot = random.uniform(min_os, max_os)

    # Control points for cubic Bezier
    ctrl1_x = x0 + dx * 0.30 + perp_x * arc_factor1
    ctrl1_y = y0 + dy * 0.30 + perp_y * arc_factor1

    ctrl2_x = x0 + dx * 0.75 + perp_x * arc_factor2 + ux * overshoot
    ctrl2_y = y0 + dy * 0.75 + perp_y * arc_factor2 + uy * overshoot

    points: list[tuple[float, float]] = []
    num_steps = max(10, steps)

    for i in range(num_steps + 1):
        u = i / float(num_steps)
        # Ease-in-out timing distribution (slow start, fast mid, slow end)
        t = (1.0 - math.cos(u * math.pi)) / 2.0

        one_minus_t = 1.0 - t
        omt2 = one_minus_t * one_minus_t
        omt3 = omt2 * one_minus_t
        t2 = t * t
        t3 = t2 * t

        px = omt3 * x0 + 3.0 * omt2 * t * ctrl1_x + 3.0 * one_minus_t * t2 * ctrl2_x + t3 * x1
        py = omt3 * y0 + 3.0 * omt2 * t * ctrl1_y + 3.0 * one_minus_t * t2 * ctrl2_y + t3 * y1
        points.append((round(px, 2), round(py, 2)))

    return points


def calculate_path_curvature(points: list[tuple[float, float]]) -> float:
    """Computes mean curvature / deviation from straight line connecting first and last point."""
    if len(points) < 3:
        return 0.0
    x0, y0 = points[0]
    x1, y1 = points[-1]
    dx = x1 - x0
    dy = y1 - y0
    chord_len = math.hypot(dx, dy)
    if chord_len < 1e-6:
        return 0.0

    max_dev = 0.0
    for px, py in points[1:-1]:
        # Distance from point to line segment
        dev = abs(dy * px - dx * py + x1 * y0 - y1 * x0) / chord_len
        if dev > max_dev:
            max_dev = dev
    return max_dev


def human_move_mouse(
    client: Any,
    target_x: float,
    target_y: float,
    from_pos: tuple[float, float] | None = None,
    profile: dict[str, Any] | None = None,
) -> tuple[float, float]:
    """Simulates moving the mouse along a natural Bezier curve towards (target_x, target_y)."""
    global _LAST_MOUSE_POS
    prof = profile or load_human_profile()
    mouse_cfg = prof.get("mouse", {})
    overshoot_range = mouse_cfg.get("overshoot_px", [2, 14])
    settle_ms = mouse_cfg.get("settle_ms", [60, 180])

    start_pos = from_pos or _LAST_MOUSE_POS
    trajectory = generate_bezier_trajectory(start_pos, (target_x, target_y), overshoot_range=overshoot_range)

    for pt in trajectory:
        try:
            client._send("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": pt[0], "y": pt[1]})
        except Exception:
            pass
        # Tiny random sleep between intermediate movement frames
        time.sleep(random.uniform(0.005, 0.015))

    # Settle at destination
    settle_time = random.uniform(settle_ms[0], settle_ms[1]) / 1000.0
    time.sleep(settle_time)

    _LAST_MOUSE_POS = (target_x, target_y)
    return (target_x, target_y)


def human_click_at(
    client: Any,
    target_x: float,
    target_y: float,
    from_pos: tuple[float, float] | None = None,
    profile: dict[str, Any] | None = None,
) -> tuple[float, float]:
    """Moves mouse smoothly along Bezier curve to target and performs a human-like click."""
    prof = profile or load_human_profile()
    
    # 1. Pre-interaction reading/thinking pause
    pause_cfg = prof.get("pause", {})
    before_ms = pause_cfg.get("before_field_ms", [300, 800])
    time.sleep(random.uniform(before_ms[0], before_ms[1]) / 1000.0)

    # 2. Add small Gaussian offset jitter within click area
    jitter_x = target_x + random.uniform(-3.0, 3.0)
    jitter_y = target_y + random.uniform(-2.5, 2.5)

    # 3. Move mouse along Bezier curve
    human_move_mouse(client, jitter_x, jitter_y, from_pos=from_pos, profile=prof)

    # 4. Click press with hold duration
    try:
        client._send(
            "Input.dispatchMouseEvent",
            {"type": "mousePressed", "x": jitter_x, "y": jitter_y, "button": "left", "clickCount": 1},
        )
    except Exception:
        pass

    hold_duration = random.uniform(0.05, 0.14)
    time.sleep(hold_duration)

    try:
        client._send(
            "Input.dispatchMouseEvent",
            {"type": "mouseReleased", "x": jitter_x, "y": jitter_y, "button": "left", "clickCount": 1},
        )
    except Exception:
        pass

    # 5. Post-click brief settle
    after_ms = pause_cfg.get("after_field_ms", [150, 400])
    time.sleep(random.uniform(after_ms[0], after_ms[1]) / 1000.0)

    return (jitter_x, jitter_y)


def human_click_by_text(client: Any, text: str, profile: dict[str, Any] | None = None) -> bool:
    """Finds an element by text and clicks it using human-like mouse movement."""
    el = client.find_element(text)
    if el is None:
        target_lower = text.strip().lower()
        synonyms = ["continuer", "suivant", "next", "weiter", "fortfahren", "envoyer", "valider", "submit", "ок"]
        if target_lower in synonyms:
            for syn in synonyms:
                if syn != target_lower:
                    el = client.find_element(syn)
                    if el is not None:
                        break
            if el is None:
                el = client.find_submit_button()
    if el is None:
        return False

    human_click_at(client, el["x"], el["y"], profile=profile)
    return True


def sample_typing_delay(profile: dict[str, Any] | None = None) -> float:
    """Samples a typing delay in seconds conforming to 30-80ms mean with natural std dev."""
    # Target uniform/jitter distribution 30-80ms with mean ~55ms and std dev > 5ms
    # Using uniform distribution [0.030, 0.080] produces mean = 55ms, std dev = sqrt((80-30)^2 / 12) = 14.4ms > 5ms
    delay = random.uniform(0.030, 0.080)
    return delay


def human_type(client: Any, text: str, profile: dict[str, Any] | None = None) -> None:
    """Types text with natural human inter-keystroke intervals and micro-pauses."""
    prof = profile or load_human_profile()
    typing_cfg = prof.get("typing", {})
    idle_cfg = prof.get("idle", {})
    micro_pause_prob = float(idle_cfg.get("micro_pause_prob", 0.15))
    micro_pause_ms = idle_cfg.get("micro_pause_ms", [300, 800])

    try:
        client._send(
            "Runtime.evaluate",
            {"expression": "(function(){var e=document.activeElement;if(e&&typeof e.select==='function'){e.select();}})()"},
        )
    except Exception:
        pass

    time.sleep(random.uniform(0.15, 0.35))

    for char in text:
        try:
            client._send("Input.insertText", {"text": char})
        except Exception:
            pass

        # Check for occasional micro-pause (human thinking/reading while typing)
        if random.random() < micro_pause_prob:
            time.sleep(random.uniform(micro_pause_ms[0], micro_pause_ms[1]) / 1000.0)
        else:
            delay = sample_typing_delay(prof)
            time.sleep(delay)

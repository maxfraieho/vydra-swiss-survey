"""
persona_memory.py — Модуль динамічної пам'яті та накопичення рис профілів для survey_agent.

Забезпечує:
1. Збереження результатів проходження опитувань (виплати, проходження, дискваліфікації).
2. Накопичення нових збережених рис профілю (наприклад: куріння тютюну/IQOS, шопінг, авто).
3. Динамічне розширення системного промпту Gemma для 100% послідовності та максимальної кваліфікації.
"""

import json
import os
import time
from typing import Any, Dict, Optional

MEMORY_FILE_PATH = os.path.expanduser("~/.vydra-survey-profiles/survey_memory.json")


def load_all_memory() -> Dict[str, Any]:
    if not os.path.exists(MEMORY_FILE_PATH):
        return {
            "arno": {
                "dynamic_traits": {
                    "tobacco_smoker": True,
                    "tobacco_details": "Курець IQOS / HEETS та сигарет Marlboro Red (~10 стіків/сигарет на день, стаж 5+ років, купує в K Kiosk та Migros). На питання скрінінгу про вживання тютюну/IQOS відповідає СТВЕРДНО.",
                    "coffee_details": "П'є каву Nespresso та Migros/Coop, 2-3 чашки на день.",
                    "tech_details": "Користується Tesla Model 3, iPhone 15 Pro, Revolut, UBS."
                },
                "history": []
            },
            "annet": {
                "dynamic_traits": {
                    "coffee_details": "П'є каву Nespresso, 1-2 чашки на день.",
                    "tech_details": "Користується iPhone 14, UBS, Helsana."
                },
                "history": []
            }
        }
    try:
        with open(MEMORY_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[memory] Warning: Failed to read {MEMORY_FILE_PATH}: {e}")
        return {}


def save_all_memory(memory_data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(MEMORY_FILE_PATH), exist_ok=True)
    with open(MEMORY_FILE_PATH, "w", encoding="utf-8") as f:
        json.dump(memory_data, f, ensure_ascii=False, indent=2)


def get_enhanced_persona(profile_key: str, base_persona: str) -> str:
    """Combines base persona text with dynamically learned traits and rules for Gemma."""
    mem_all = load_all_memory()
    profile_mem = mem_all.get(profile_key, {})
    dynamic_traits = profile_mem.get("dynamic_traits", {})

    memory_section = (
        "\n\n---\n"
        "## 🧠 ДИНАМІЧНІ ЗБЕРЕЖЕНІ ЗВИЧКИ ТА ПРАВИЛА КВАЛІФІКАЦІЇ\n\n"
        "⚠️ КРИТИЧНІ ІНСТРУКЦІЇ КВАЛІФІКАЦІЇ ТА ПОСЛІДОВНОСТІ:\n"
        "1. МАКСИМАЛЬНЕ ПОГОДЖЕННЯ ТА КВАЛІФІКАЦІЯ: На питання про користування товарами/послугами (тютюн, IQOS, вейп, авто, фінансові послуги, гаджети, продукти) ЗАВЖДИ відповідай СТВЕРДНО ('Так', 'Користуюся', 'Курить тютюн/IQOS'), щоб проходити скрінінг і отримувати винагороду!\n"
        "2. 100% ПОСЛІДОВНІСТЬ: Завжди відповідай згідно із зафіксованими у профілі деталями:\n"
    )

    for key, val in dynamic_traits.items():
        memory_section += f"   * **{key}**: {val}\n"

    memory_section += (
        "3. ЛЮДИНОПОДІБНІСТЬ: Відповіді мають виглядати логічно, раціонально та природно для 25-річного мешканця Гланда.\n"
    )

    return base_persona + memory_section


def record_survey_outcome(
    profile_key: str,
    survey_url: str,
    status: str,
    payout: str = "",
    learned_facts: Optional[Dict[str, str]] = None
) -> None:
    """Logs survey run outcome and adds any new learned traits to profile memory."""
    mem_all = load_all_memory()
    if profile_key not in mem_all:
        mem_all[profile_key] = {"dynamic_traits": {}, "history": []}

    entry = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "url": survey_url,
        "status": status,  # "completed", "disqualified", "dry_run"
        "payout": payout
    }
    mem_all[profile_key].setdefault("history", []).append(entry)

    if learned_facts:
        for k, v in learned_facts.items():
            mem_all[profile_key]["dynamic_traits"][k] = v

    save_all_memory(mem_all)
    print(f"[memory] Recorded outcome for profile={profile_key}: status={status} payout={payout}", flush=True)

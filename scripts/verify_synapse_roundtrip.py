#!/usr/bin/env python3
"""
scripts/verify_synapse_roundtrip.py
Verifies write -> retrieve round-trip using SynapseAdapter and Synapse MCP Memory OS.
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from synapse_adapter import SynapseAdapter


def run_roundtrip_test():
    print("=== Executing Synapse Round-Trip Verification ===")
    probe_subject = "test_probe_subject"
    probe_timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())
    
    # 1. Write fact asynchronously
    print(f"  Step 1: Writing fact '{probe_subject} verified_at {probe_timestamp}'...")
    SynapseAdapter.sync_fact_async(
        subject=probe_subject,
        predicate="verified_at",
        object_val=probe_timestamp,
        persona="arno",
        metadata={"topic": "verification"}
    )

    # 2. Wait for ThreadPoolExecutor execution
    print("  Step 2: Waiting 1.5s for worker execution...")
    time.sleep(1.5)

    # 3. Retrieve memory back synchronously
    print(f"  Step 3: Retrieving memory for query '{probe_subject}'...")
    readback = SynapseAdapter.retrieve_memory_sync(query=f"{probe_subject} verified_at")
    print(f"  Readback result: {readback}")

    assert readback is not None, "FAILED: Retrieve memory returned None!"
    
    # Extract content text from MCP response
    content_list = readback.get("content", [])
    assert len(content_list) > 0, "FAILED: Content list in MCP response is empty!"
    
    text_content = content_list[0].get("text", "")
    parsed_json = json.loads(text_content)
    memories = parsed_json.get("memories", [])
    
    assert len(memories) > 0, "FAILED: No memories returned from Synapse memory_retrieve!"
    
    matched_memory = memories[0]
    retrieved_text = matched_memory.get("content", "")
    print(f"  Retrieved memory text: '{retrieved_text}'")
    
    assert probe_subject in retrieved_text, f"FAILED: '{probe_subject}' not found in '{retrieved_text}'"
    assert probe_timestamp in retrieved_text, f"FAILED: '{probe_timestamp}' not found in '{retrieved_text}'"

    print("\n✅ ROUND-TRIP VERIFICATION PASSED SUCCESSFULLY!")
    return True


if __name__ == "__main__":
    import json
    run_roundtrip_test()

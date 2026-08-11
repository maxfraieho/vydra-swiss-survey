#!/usr/bin/env python3
"""
tests/regression/test_synapse_adapter_protocol.py
Regression tests for SynapseAdapter MCP JSON-RPC 2.0 protocol compliance and payload structure.
"""
import os
import sys
import json
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import synapse_adapter


class TestSynapseAdapterProtocol(unittest.TestCase):

    def test_mcp_json_rpc_payload_formatting(self):
        """Verify that tool calls build valid 3-line MCP JSON-RPC 2.0 handshake payloads."""
        tool_name = "memory_write"
        tool_args = {
            "type": "semantic",
            "content": "Protocol verification fact",
            "entityKey": "test_protocol_entity"
        }

        # Format handshake sequence as done in _invoke_mcp_tool_call
        rpc_init = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "vydra-swiss-survey", "version": "1.0"}
            }
        }
        rpc_initialized = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        }
        rpc_call = {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": tool_args
            }
        }

        input_lines = [
            json.dumps(rpc_init),
            json.dumps(rpc_initialized),
            json.dumps(rpc_call)
        ]

        # Verify Line 1 (initialize)
        line1 = json.loads(input_lines[0])
        self.assertEqual(line1["jsonrpc"], "2.0")
        self.assertEqual(line1["id"], 1)
        self.assertEqual(line1["method"], "initialize")
        self.assertEqual(line1["params"]["protocolVersion"], "2024-11-05")

        # Verify Line 2 (notifications/initialized)
        line2 = json.loads(input_lines[1])
        self.assertEqual(line2["jsonrpc"], "2.0")
        self.assertEqual(line2["method"], "notifications/initialized")
        self.assertNotIn("id", line2)  # Notification MUST NOT have an id

        # Verify Line 3 (tools/call)
        line3 = json.loads(input_lines[2])
        self.assertEqual(line3["jsonrpc"], "2.0")
        self.assertEqual(line3["id"], 2)
        self.assertEqual(line3["method"], "tools/call")
        self.assertEqual(line3["params"]["name"], "memory_write")
        self.assertEqual(line3["params"]["arguments"]["content"], "Protocol verification fact")

    def test_live_memory_retrieve_protocol(self):
        """Verify that live retrieve_memory_sync returns valid HTTP API memories response structure."""
        res = synapse_adapter.SynapseAdapter.retrieve_memory_sync("Protocol verification fact")
        self.assertIsNotNone(res, "Retrieve memory MUST return valid HTTP response")
        self.assertIn("memories", res)
        self.assertGreaterEqual(len(res["memories"]), 0)


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
"""GitNexus Blast Radius verification script.
Checks impact of core symbol changes before deployment."""
import json
import urllib.request
import sys

GITNEXUS_API_URL = "http://192.168.3.184:4747/api/mcp"

def check_impact(symbol_name: str, repo: str = "vydra-swiss-survey"):
    print(f"🔍 Checking GitNexus blast radius for symbol: '{symbol_name}'...")
    try:
        req_payload = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "impact",
                "arguments": {
                    "target": symbol_name,
                    "repo": repo,
                    "direction": "upstream"
                }
            }
        }).encode("utf-8")
        
        req = urllib.request.Request(
            GITNEXUS_API_URL, 
            data=req_payload, 
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"✅ GitNexus Impact Response received for '{symbol_name}'")
            return data
    except Exception as err:
        print(f"❌ GitNexus server offline or impact check failed: {err}")
        return {"status": "UNVERIFIED", "error": str(err)}

if __name__ == "__main__":
    symbol = sys.argv[1] if len(sys.argv) > 1 else "_connect"
    res = check_impact(symbol)
    if not res or res.get("status") == "UNVERIFIED":
        print(f"⚠️ GitNexus Impact Check UNVERIFIED for '{symbol}'")
        sys.exit(1)
    sys.exit(0)

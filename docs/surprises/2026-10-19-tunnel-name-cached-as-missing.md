---
id: 2026-10-19-tunnel-name-cached-as-missing
found: tooling
kind: drive-kit
status: fixed
reviewed: true
pattern: drive-kit
---
**Expected:** a fresh Cloudflare quick tunnel answers on its `trycloudflare.com` name within a minute, so polling it right away and retrying shows when it is live.
**Actual:** three tunnels in a row read "Could not resolve host" for over two minutes each, on the system resolver, `1.1.1.1` and `8.8.8.8`. Two were restarted for nothing. The third resolved at once on `9.9.9.9`, `208.67.222.222` and `1.0.0.1`, and Windows `curl.exe` pinned to that IP got `200` on `/join`.
**Cause:** no repo code; the check was mine, run by hand @ 27ef5aa0. The first lookup ran before Cloudflare published the name, and every resolver it asked cached "no such name" for minutes. Each retry read the cache, not the tunnel.
**Fix:** none in code. Test a new tunnel on a resolver not yet asked (`Resolve-DnsName <host> -Server 9.9.9.9`), then `curl.exe --resolve <host>:443:<ip>`. Git Bash `curl` fails TLS here with "unable to get local issuer certificate", so use Windows `curl.exe`.

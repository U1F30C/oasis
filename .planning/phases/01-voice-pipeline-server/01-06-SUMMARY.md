---
phase: "01-voice-pipeline-server"
plan: "06"
subsystem: "documentation"
tags: ["iot", "websocket", "protocol", "raspberry-pi", "arecord", "documentation"]
dependency_graph:
  requires:
    - "01-03: WebSocket handler (ws.ts) — documents its binary frame format and JSON control messages"
    - "01-05: Frontend audio path — documents Float32Array PCM format used by browser client"
  provides:
    - "docs/iot-protocol.md — Complete IoT device integration guide for the Oasis WebSocket server"
  affects:
    - "01-07: Verification — protocol doc is a deliverable requirement"
tech_stack:
  added: []
  patterns:
    - "Binary WebSocket framing: Float32Array PCM (raw) or WAV container (RIFF magic-byte detection)"
    - "press-Enter-to-record interaction pattern for IoT headless devices via arecord + ws"
key_files:
  created:
    - "docs/iot-protocol.md — Complete IoT protocol guide: WebSocket URL, handshake, binary frame formats, arecord/aplay commands, Node.js client example, latency table, troubleshooting table"
  modified: []
decisions:
  - "Documented both Float32Array raw PCM (browser-identical path) and WAV file bytes (simpler IoT path) so constrained devices can choose based on their audio stack capabilities"
  - "Node.js example uses WAV format (S16_LE) rather than raw PCM for simplicity — easier to debug and universally supported by arecord without needing FLOAT_LE hardware support"
  - "Placeholder IP 192.168.1.X used in examples per threat model T-01-13 — no real server addresses in documentation"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-16"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
---

# Phase 1 Plan 6: IoT Protocol Documentation Summary

**One-liner:** Complete IoT integration guide for constrained devices — WebSocket URL, Float32Array and WAV binary frame formats, arecord/aplay Raspberry Pi commands, Node.js press-to-talk client example, latency table, and troubleshooting table.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create docs/iot-protocol.md — complete IoT device WebSocket protocol guide | 8705a34 |

## Verification Results

All acceptance criteria met:

- `docs/iot-protocol.md` exists
- File contains `arecord` (9 occurrences — both Float32 raw PCM and S16_LE WAV variants)
- File contains `Float32` (2 occurrences — format table and raw PCM description)
- File contains `{ "type": "ready" }` (3 occurrences — handshake and control messages table)
- File contains `{ "type": "processing" }` (1 occurrence — control messages table)
- File contains `16000` (6 occurrences — sample rate specs throughout)
- File contains `aplay` (6 occurrences — playback section and troubleshooting)
- File contains a Node.js IoT client code example (`iot-client.js` — full press-to-talk implementation)
- File contains a troubleshooting table (5 rows covering common failure modes)
- `grep -c "^##" docs/iot-protocol.md` returns 11 (exceeds minimum of 5 sections)

Automated verify command result:
```
grep -c "arecord\|Float32\|WebSocket\|RECEIVING\|SENDING\|ready\|iot-client" docs/iot-protocol.md
26
```

## Deviations from Plan

The file existed on disk as an untracked file from prior wave activity. It was missing:
1. The `FLOAT_LE` raw PCM `arecord` command (only WAV format was present)
2. The "Set PORT in server's .env file" note in the WebSocket Endpoint section
3. The full Node.js IoT client example code (only a filename reference existed)
4. The Pipeline Latency table
5. The Troubleshooting table

**Action taken:** Rewrote the file using the complete content specified in the plan. No plan requirements were removed or altered. The existing REST API Alternatives section from the prior draft was not included in the plan specification but is covered by the WebSocket protocol being the primary interface (REST routes exist per 01-03).

All deviations were covered by writing the complete specified content.

## Threat Model Compliance

| Threat ID | Mitigation | Status |
|-----------|-----------|--------|
| T-01-13 | Information Disclosure — docs/iot-protocol.md uses placeholder IP `192.168.1.X` (not a real address); no credentials or secrets in the document | Compliant |

## Known Stubs

None — documentation is complete with all required sections, examples, and tables.

## Self-Check: PASSED

Files verified:
- FOUND: /home/eric/Downloads/Projects/oasis/docs/iot-protocol.md

Commits verified:
- FOUND: 8705a34 (docs/iot-protocol.md)

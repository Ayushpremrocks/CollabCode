package com.collabcode.websocket.yjs;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Wire protocol between the browser (collaborationService.ts) and the Yjs relay.
 *
 * Every binary frame starts with a one-byte message type:
 * <pre>
 *  client → server
 *    0 UPDATE    [0][yjs update]                         appended to the room log and relayed
 *    1 AWARENESS [1][y-protocols awareness update]       relayed; remembered for late joiners
 *    2 SNAPSHOT  [2][uint32 BE ack][full yjs state]      used to compact the log + persist
 *
 *  server → client
 *    3 BASE      [3][yjs state or empty]                 always the first frame after connect
 *    0 UPDATE    [0][yjs update]                         log replay + live edits from others
 *    1 AWARENESS [1][awareness update]                   peers' cursors / names
 * </pre>
 *
 * {@code ack} in a SNAPSHOT is the number of BASE + UPDATE frames the client had
 * received when it encoded that state. It lets the server know exactly which log
 * entries the snapshot already contains, so compaction never drops an edit.
 */
public final class YjsProtocol {

    public static final int MSG_UPDATE = 0;
    public static final int MSG_AWARENESS = 1;
    public static final int MSG_SNAPSHOT = 2;
    public static final int MSG_BASE = 3;

    /** Custom close codes understood by the frontend. */
    public static final int CLOSE_UNAUTHORIZED = 4401; // token missing/expired → retry with a fresh token
    public static final int CLOSE_FORBIDDEN = 4403;    // not a participant → do not retry
    public static final int CLOSE_NOT_FOUND = 4404;    // room missing/expired/deleted → do not retry

    private YjsProtocol() {}

    public static byte[] frame(int type, byte[] payload) {
        byte[] out = new byte[payload.length + 1];
        out[0] = (byte) type;
        System.arraycopy(payload, 0, out, 1, payload.length);
        return out;
    }

    // ── lib0 encoding helpers (used by y-protocols/awareness) ───────────────

    /** Cursor over a byte array, decoding lib0 var-uints and var-strings. */
    static final class Decoder {
        private final byte[] buf;
        private int pos;

        Decoder(byte[] buf) { this.buf = buf; }

        long readVarUint() {
            long num = 0;
            int shift = 0;
            while (true) {
                if (pos >= buf.length) throw new IllegalArgumentException("Unexpected end of buffer");
                int b = buf[pos++] & 0xFF;
                num |= (long) (b & 0x7F) << shift;
                if (b < 0x80) return num;
                shift += 7;
                if (shift > 63) throw new IllegalArgumentException("VarUint too long");
            }
        }

        String readVarString() {
            int len = (int) readVarUint();
            if (len < 0 || pos + len > buf.length) throw new IllegalArgumentException("Bad string length");
            String s = new String(buf, pos, len, StandardCharsets.UTF_8);
            pos += len;
            return s;
        }
    }

    static void writeVarUint(ByteArrayOutputStream out, long num) {
        while (num > 0x7F) {
            out.write((int) (0x80 | (num & 0x7F)));
            num >>>= 7;
        }
        out.write((int) num);
    }

    static void writeVarString(ByteArrayOutputStream out, String s) {
        byte[] bytes = s.getBytes(StandardCharsets.UTF_8);
        writeVarUint(out, bytes.length);
        out.write(bytes, 0, bytes.length);
    }

    /**
     * Parses an awareness update and returns clientID → clock for every entry.
     * Entries whose state is "null" (already a removal) are returned with clock -1.
     */
    public static Map<Long, Long> parseAwarenessClocks(byte[] update) {
        Decoder d = new Decoder(update);
        long count = d.readVarUint();
        Map<Long, Long> result = new LinkedHashMap<>();
        for (long i = 0; i < count; i++) {
            long clientId = d.readVarUint();
            long clock = d.readVarUint();
            String state = d.readVarString();
            result.put(clientId, "null".equals(state) ? -1L : clock);
        }
        return result;
    }

    /** Builds an awareness update that marks the given clients as offline (state = null, clock + 1). */
    public static byte[] encodeAwarenessRemoval(Map<Long, Long> clientClocks) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        writeVarUint(out, clientClocks.size());
        clientClocks.forEach((clientId, clock) -> {
            writeVarUint(out, clientId);
            writeVarUint(out, clock + 1);
            writeVarString(out, "null");
        });
        return out.toByteArray();
    }
}

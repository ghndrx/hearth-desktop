import { describe, it, expect } from 'vitest';
import { Op } from '../stores/gateway';

describe('Gateway Op codes', () => {
  it('should define all Discord-compatible opcodes', () => {
    expect(Op.DISPATCH).toBe(0);
    expect(Op.HEARTBEAT).toBe(1);
    expect(Op.IDENTIFY).toBe(2);
    expect(Op.PRESENCE_UPDATE).toBe(3);
    expect(Op.VOICE_STATE_UPDATE).toBe(4);
    expect(Op.RESUME).toBe(6);
    expect(Op.RECONNECT).toBe(7);
    expect(Op.REQUEST_GUILD_MEMBERS).toBe(8);
    expect(Op.INVALID_SESSION).toBe(9);
    expect(Op.HELLO).toBe(10);
    expect(Op.HEARTBEAT_ACK).toBe(11);
  });

  it('should skip opcode 5 per Discord protocol spec', () => {
    const opValues = Object.values(Op);
    expect(opValues).not.toContain(5);
  });

  it('should have no duplicate opcode values', () => {
    const values = Object.values(Op);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should define exactly 11 opcodes', () => {
    const keys = Object.keys(Op);
    expect(keys.length).toBe(11);
  });
});

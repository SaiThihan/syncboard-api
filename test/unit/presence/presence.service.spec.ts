import { PresenceService } from '../../../src/presence/presence.service';

const ana = { id: 'u1', name: 'Ana' };
const ben = { id: 'u2', name: 'Ben' };

describe('PresenceService', () => {
  let presence: PresenceService;

  beforeEach(() => {
    presence = new PresenceService();
  });

  it('registers a user with a colour and says it is their first connection', () => {
    const result = presence.join('s1', 'board1', ana);

    expect(result.isFirstSocket).toBe(true);
    expect(result.user).toMatchObject({ id: 'u1', name: 'Ana' });
    expect(result.user.color).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('gives different users on the same board different colours', () => {
    const a = presence.join('s1', 'board1', ana).user;
    const b = presence.join('s2', 'board1', ben).user;

    expect(a.color).not.toBe(b.color);
  });

  it('treats a second connection of the same user as the same person', () => {
    const first = presence.join('s1', 'board1', ana);
    const second = presence.join('s2', 'board1', ana);

    expect(second.isFirstSocket).toBe(false);
    expect(second.user).toBe(first.user);
    expect(presence.getRoster('board1')).toHaveLength(1);
  });

  it('lists everyone on a board and keeps boards separate', () => {
    presence.join('s1', 'board1', ana);
    presence.join('s2', 'board1', ben);
    presence.join('s3', 'board2', ana);

    expect(presence.getRoster('board1').map((u) => u.name)).toEqual([
      'Ana',
      'Ben',
    ]);
    expect(presence.getRoster('board2').map((u) => u.name)).toEqual(['Ana']);
  });

  it('returns an empty roster for a board nobody joined', () => {
    expect(presence.getRoster('nobody')).toEqual([]);
  });

  it('finds which board and user a connection belongs to', () => {
    presence.join('s1', 'board1', ana);

    expect(presence.getBySocket('s1')).toMatchObject({
      boardId: 'board1',
      user: { id: 'u1' },
    });
    expect(presence.getBySocket('unknown')).toBeUndefined();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import RichPresenceCard from '../RichPresenceCard.svelte';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (cmd: string, args?: object) => mockInvoke(cmd, args),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}));

describe('RichPresenceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(undefined);
  });

  it('renders offline friend with no presence', () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'user123',
          presence: null,
          is_online: false,
        },
      },
    });

    expect(screen.getByText('user123')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('renders online friend without game activity', () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'user456',
          presence: null,
          is_online: true,
        },
      },
    });

    expect(screen.getByText('user456')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('renders friend playing a game with details', () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'gamer1',
          presence: {
            game_id: '730',
            game_name: 'Counter-Strike 2',
            state: 'In Match',
            details: 'Competitive - Dust2',
            timestamp: Math.floor(Date.now() / 1000) - 120,
            party_info: null,
            metadata: null,
          },
          is_online: true,
        },
      },
    });

    expect(screen.getByText('gamer1')).toBeInTheDocument();
    expect(screen.getByText('Playing Counter-Strike 2')).toBeInTheDocument();
    expect(screen.getByText('Competitive - Dust2')).toBeInTheDocument();
    expect(screen.getByText('In Match')).toBeInTheDocument();
  });

  it('renders party info when present', () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'gamer2',
          presence: {
            game_id: '570',
            game_name: 'Dota 2',
            state: 'Playing',
            details: 'Ranked Match',
            timestamp: Math.floor(Date.now() / 1000),
            party_info: {
              party_id: 'party_abc',
              party_size: 3,
              party_max: 5,
            },
            metadata: null,
          },
          is_online: true,
        },
      },
    });

    expect(screen.getByText('Party 3/5')).toBeInTheDocument();
  });

  it('shows join and spectate buttons when showActions is true', () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'gamer3',
          presence: {
            game_id: '730',
            game_name: 'CS2',
            state: 'Playing',
            details: '',
            timestamp: 1000,
            party_info: null,
            metadata: null,
          },
          is_online: true,
        },
        showActions: true,
      },
    });

    expect(screen.getByText('Join')).toBeInTheDocument();
    expect(screen.getByText('Watch')).toBeInTheDocument();
  });

  it('hides action buttons when showActions is false', () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'gamer4',
          presence: {
            game_id: '730',
            game_name: 'CS2',
            state: 'Playing',
            details: '',
            timestamp: 1000,
            party_info: null,
            metadata: null,
          },
          is_online: true,
        },
        showActions: false,
      },
    });

    expect(screen.queryByText('Join')).not.toBeInTheDocument();
    expect(screen.queryByText('Watch')).not.toBeInTheDocument();
  });

  it('calls join_game when Join is clicked', async () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'gamer5',
          presence: {
            game_id: '730',
            game_name: 'CS2',
            state: 'Playing',
            details: '',
            timestamp: 1000,
            party_info: {
              party_id: 'party_xyz',
              party_size: 2,
              party_max: 5,
            },
            metadata: null,
          },
          is_online: true,
        },
      },
    });

    await fireEvent.click(screen.getByText('Join'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('join_game', {
        gameId: '730',
        partyId: 'party_xyz',
      });
    });
  });

  it('calls spectate_game when Watch is clicked', async () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'gamer6',
          presence: {
            game_id: '570',
            game_name: 'Dota 2',
            state: 'Playing',
            details: '',
            timestamp: 1000,
            party_info: null,
            metadata: null,
          },
          is_online: true,
        },
      },
    });

    await fireEvent.click(screen.getByText('Watch'));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('spectate_game', { gameId: '570' });
    });
  });

  it('displays avatar initials from friend_id', () => {
    render(RichPresenceCard, {
      props: {
        friendPresence: {
          friend_id: 'testuser',
          presence: null,
          is_online: false,
        },
      },
    });

    expect(screen.getByText('TE')).toBeInTheDocument();
  });
});

import { newGame, type GameState } from './state';

/**
 * The one live game. Scenes read and mutate `session.state`; New Game and
 * Continue replace it wholesale.
 */
export const session: { state: GameState } = { state: newGame() };

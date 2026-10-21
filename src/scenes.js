// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`, Gladys 5.1+).
//
// One action: read a game server now, and hand its state to the next actions
// of the scene ("{{1.0.players_online}} players on {{1.0.map}}"), or to a
// "Continue only if" condition on `online`.
// -----------------------------------------------------------------------------

export const SCENE_ACTIONS = {
  async read_server(hub, { fields = {} }) {
    return hub.readForScene(fields.device || null);
  },
};

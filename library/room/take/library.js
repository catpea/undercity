// library/room/take/library.js
import { Emitter } from 'framework';

export function run(params, ctx) {
  const emitter = new Emitter();
  // Fire the 'take' event on the room bus. Any FormThing in this room whose
  // 'take' workflow is wired will receive it and render its Input/Display actions.
  ctx.room.emit('take', { form: params.form ?? null });
  emitter.emit('done');
  return emitter;
}

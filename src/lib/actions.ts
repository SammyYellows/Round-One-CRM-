// Every change a page can make, by name. Pages call act("setStage", id, stage)
// instead of passing a function, so the same change can run on the server
// against the database. To add one: write it in engine.ts, then list it here.

import {
  addContact, bookTrial, completeTask, createAppointment, markNoShow, receiveMessage, rescheduleAppointment, sendMessage,
  sendTemplateTo, setAppointmentStatus, setStage, shiftClock, stopRun, submitForm, toggleAutomation, updateForm,
} from "./engine";
import { State } from "./types";

export const ACTIONS = {
  addContact,
  bookTrial,
  completeTask,
  createAppointment,
  markNoShow,
  rescheduleAppointment,
  sendMessage,
  sendTemplateTo,
  setAppointmentStatus,
  setStage,
  stopRun,
  toggleAutomation,
  updateForm,
  // Local prototype only (see SERVER_REFUSES).
  receiveMessage,
  shiftClock,
  submitForm,
};

export type ActionName = keyof typeof ACTIONS;
type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;
export type ActionArgs<N extends ActionName> = Tail<Parameters<(typeof ACTIONS)[N]>>;

/**
 * Not accepted from the staff screens on the server: fake replies and the
 * prototype clock only make sense with sample data, and form submissions come
 * through the public form route instead.
 */
export const SERVER_REFUSES = new Set<ActionName>(["receiveMessage", "shiftClock", "submitForm"]);

export function isActionName(x: unknown): x is ActionName {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(ACTIONS, x);
}

export function runAction<N extends ActionName>(s: State, name: N, args: ActionArgs<N>) {
  (ACTIONS[name] as (s: State, ...a: unknown[]) => unknown)(s, ...(args as unknown[]));
}

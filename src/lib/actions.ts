// Every change a page can make, by name. Pages call act("setStage", id, stage)
// instead of passing a function, so the same change can run on the server
// against the database. To add one: write it in engine.ts, then list it here.

import {
  addContact, addTag, bookTrial, completeTask, createAppointment, markNoShow, receiveMessage, receiveWhatsApp, rescheduleAppointment, sendMessage,
  sendTemplateTo, setAppointmentStatus, setAvailability, setStage, shiftClock, stopRun, submitForm, toggleAutomation, updateForm,
} from "./engine";
import { State } from "./types";

export const ACTIONS = {
  addContact,
  addTag,
  bookTrial,
  completeTask,
  createAppointment,
  markNoShow,
  rescheduleAppointment,
  sendMessage,
  sendTemplateTo,
  setAppointmentStatus,
  setAvailability,
  setStage,
  stopRun,
  toggleAutomation,
  updateForm,
  // Not from the staff screens (see SERVER_REFUSES).
  receiveMessage,
  receiveWhatsApp,
  shiftClock,
  submitForm,
};

export type ActionName = keyof typeof ACTIONS;
type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;
export type ActionArgs<N extends ActionName> = Tail<Parameters<(typeof ACTIONS)[N]>>;

/**
 * Not accepted from the staff screens on the server: fake replies and the
 * prototype clock only make sense with sample data, form submissions come
 * through the public form route, and real WhatsApp messages through Meta's
 * webhook.
 */
export const SERVER_REFUSES = new Set<ActionName>(["receiveMessage", "receiveWhatsApp", "shiftClock", "submitForm"]);

export function isActionName(x: unknown): x is ActionName {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(ACTIONS, x);
}

export function runAction<N extends ActionName>(s: State, name: N, args: ActionArgs<N>) {
  (ACTIONS[name] as (s: State, ...a: unknown[]) => unknown)(s, ...(args as unknown[]));
}

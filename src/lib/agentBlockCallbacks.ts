export type AddTaskHandler = (
  title: string,
  jiraKey?: string,
  jiraUrl?: string
) => void;

let addTaskHandler: AddTaskHandler | undefined;

export function setAgentBlockAddTaskHandler(handler: AddTaskHandler | undefined) {
  addTaskHandler = handler;
}

export function getAgentBlockAddTaskHandler() {
  return addTaskHandler;
}

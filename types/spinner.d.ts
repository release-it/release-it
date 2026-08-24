export default interface Spinner {
  show<TaskReturnType, TaskType extends () => Promise<TaskReturnType>>({
    enabled,
    task,
    label,
    external,
    context
  }: {
    enabled?: boolean;
    task: TaskType;
    label?: string;
    external?: boolean;
    context?: object | null;
  }): ReturnType<TaskType>;
}

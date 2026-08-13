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
    context?: Record<string, any> | null;
  }): ReturnType<TaskType>;
}

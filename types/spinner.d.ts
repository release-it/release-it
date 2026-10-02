export type SpinnerShowOptions<TaskReturnType> = {
  enabled?: boolean;
  task: () => TaskReturnType | Promise<TaskReturnType>;
  label?: string;
  external?: boolean;
  context?: object | null;
};

export default class Spinner {
  show<TaskReturnType>(
    options: SpinnerShowOptions<TaskReturnType>
  ): TaskReturnType | Promise<TaskReturnType>;
}

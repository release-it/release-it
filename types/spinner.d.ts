export type SpinnerShowOptions<TaskReturnType> = {
  enabled?: boolean;
  task: () => TaskReturnType;
  label?: string;
  external?: boolean;
  context?: object | null;
};
export type EnabledSpinnerShowOptions<TaskReturnType> = {
  enabled?: true;
} & SpinnerShowOptions<TaskReturnType>;
export type DisabledSpinnerShowOptions<TaskReturnType> = {
  enabled: false;
} & SpinnerShowOptions<TaskReturnType>;

export default class Spinner {
  show<TaskReturnType>(
    options: EnabledSpinnerShowOptions<TaskReturnType>
  ): TaskReturnType;
  show<TaskReturnType>(
    options: DisabledSpinnerShowOptions<TaskReturnType>
  ): Promise<undefined>;
  show<TaskReturnType>(
    options: SpinnerShowOptions<TaskReturnType>
  ): TaskReturnType | Promise<undefined>;
}

/** Данные формы входа. */
export interface ILoginValues {
  login: string;
  password: string;
}

export interface IProps {
  /** Отправка формы. Отказ означает, что пара не подошла. */
  onSubmit: (values: ILoginValues) => Promise<void>;
}

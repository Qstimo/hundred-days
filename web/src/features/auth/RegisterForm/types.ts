/** Данные формы регистрации. */
export interface IRegisterValues {
  login: string;
  name: string;
  password: string;
}

export interface IProps {
  /** Отправка. Отказ означает, что данные не приняты. */
  onSubmit: (values: IRegisterValues) => Promise<void>;
  /** Сообщение об отказе от сервера. Пусто — отказа не было. */
  error?: string;
}

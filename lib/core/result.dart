class Result<T> {
  final T? data;
  final String? error;

  const Result._({this.data, this.error});
  bool get isOk => error == null;

  static Result<T> ok<T>(T data) => Result._(data: data);
  static Result<T> fail<T>(String message) => Result._(error: message);
}

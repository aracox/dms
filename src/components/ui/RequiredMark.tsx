/** Red asterisk marking a required field label. Pair with the input's `required` attribute. */
export function RequiredMark() {
  return (
    <span className="text-brand-red" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

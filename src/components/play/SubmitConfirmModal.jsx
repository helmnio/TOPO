function SubmitConfirmModal({
  isOpen,
  onCancel,
  onConfirm,
  title = 'Submit your map?',
  message = 'You only get one attempt.',
  confirmLabel = 'Submit',
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirm-overlay">
      <div className="confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>

        <div className="confirm-actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="button button--primary"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubmitConfirmModal;

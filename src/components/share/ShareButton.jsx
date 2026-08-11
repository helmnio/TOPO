import { useState } from 'react';

import { copyShareText } from '../../utils/share';

function ShareButton({
  shareText,
  children = 'Share',
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    if (!shareText) {
      console.warn('No share text provided');
      return;
    }

    try {
      await copyShareText(shareText);

      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1600);
    } catch (error) {
      console.error('Failed to copy share text:', error);
    }
  };

  return (
    <button
      type="button"
      className={`button button--secondary ${className}`}
      onClick={handleClick}
    >
      {copied ? 'Copied' : children}
    </button>
  );
}

export default ShareButton;
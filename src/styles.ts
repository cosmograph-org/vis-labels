export const labelsContainerClassName = 'vis-label--labels-container'
export const hiddenLabelsContainerClassName = 'vis-label--labels-container-hidden'
export const labelClassName = 'vis-label--label'
export const hiddenLabelClassName = 'vis-label--hidden'

export const labelContainerStyles = `
  :where(:root) {
    --vis-label-background-color: none;
    --vis-label-color: inherit;
    --vis-label-border: none;
    --vis-label-box-shadow: none;
    --vis-label-filter: none;
    --vis-label-border-radius: 6px;
    --vis-label-font-weight: 500;
    --vis-label-transition: opacity 600ms;
    --vis-label-cursor: pointer;
    --vis-label-max-width: none;
    --vis-label-pointer-events: none;
  }

  :where(.${labelsContainerClassName}) {
    transition: opacity 100ms;
    position: absolute;
    width: 100%;
    height: 100%;
    overflow: hidden;
    top: 0%;
    pointer-events: none;
    opacity: 1;
  }

  :where(.${hiddenLabelsContainerClassName}) {
    opacity: 0;

    div {
      pointer-events: none;
    }
  }
`

export const labelStyles = `
  :where(.${labelClassName}) {
    position: absolute;
    top: 0;
    left: 0;

    cursor: var(--vis-label-cursor);
    
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;

    color: var(--vis-label-color);
    border: var(--vis-label-border);
    box-shadow: var(--vis-label-box-shadow);
    filter: var(--vis-label-filter);
    pointer-events: var(--vis-label-pointer-events);
    background-color: var(--vis-label-background-color);
    font-weight: var(--vis-label-font-weight);
    border-radius: var(--vis-label-border-radius);
    max-width: var(--vis-label-max-width);
    
    transition: var(--vis-label-transition);
    opacity: 1;
  }

  /* We use "important" here because the users may pass their own label class, overriding the opacity */
  :where(.${hiddenLabelClassName}) {
    opacity: 0 !important;
  }
`

export const injectStyles = (styles: string): HTMLStyleElement => {
  const styleElement = document.createElement('style')
  styleElement.innerHTML = styles

  // Insert the global CSS style element into the head of the document if it doesn't already exist
  const firstStyleTagInHead = document.head.getElementsByTagName('style')[0]
  if (firstStyleTagInHead) document.head.insertBefore(styleElement, firstStyleTagInHead)
  else document.head.appendChild(styleElement)

  return styleElement
}

import { Spec } from 'axe-core';

// Custom Axe Functions for axe.config
export const customAxeConfig: Spec = {
  branding: {
    application: 'oobee',
  },
  checks: [
    {
      id: 'oobee-confusing-alt-text',
      metadata: {
        impact: 'serious',
        messages: {
          pass: 'The image alt text is probably useful.',
          fail: "The image alt text set as 'img', 'image', 'picture', 'photo', or 'graphic' is confusing or not useful.",
        },
      },
    },
    {
      id: 'oobee-accessible-label',
      metadata: {
        impact: 'serious',
        messages: {
          pass: 'The clickable element has an accessible label.',
          fail: 'The clickable element does not have an accessible label.',
        },
      },
    },
    {
      id: 'oobee-grading-text-contents',
      metadata: {
        impact: 'moderate',
        messages: {
          pass: 'The text contents is readable text.',
          fail: 'The text content is potentially difficult to read, with a Flesch-Kincaid Reading Ease score of ${flag}. The target passing score is above 50, indicating content readable by university students and lower grade levels. A higher score reflects better readability.',
        },
      },
    },
  ],
  rules: [
    { id: 'target-size', enabled: true },
    {
      id: 'oobee-confusing-alt-text',
      selector: 'img[alt]',
      enabled: true,
      any: ['oobee-confusing-alt-text'],
      tags: ['wcag2a', 'wcag111'],
      metadata: {
        description: 'Ensures image alt text is clear and useful.',
        help: 'Image alt text must not be vague or unhelpful.',
        helpUrl: 'https://www.deque.com/blog/great-alt-text-introduction/',
      },
    },
    {
      id: 'oobee-accessible-label',
      // selector: '*', // to be set with the checker function output xpaths converted to css selectors
      enabled: true,
      any: ['oobee-accessible-label'],
      tags: ['wcag2a', 'wcag211', 'wcag243','wcag412'],
      metadata: {
        description: 'Ensures clickable elements have an accessible label.',
        help: 'Clickable elements must have accessible labels.',
        helpUrl: 'https://www.deque.com/blog/accessible-aria-buttons',
      },
    },
    {
      id: 'oobee-grading-text-contents',
      selector: 'html',
      enabled: true,
      any: ['oobee-grading-text-contents'],
      tags: ['wcag2a', 'wcag315'],
      metadata: {
        description: 'Ensures text that uses short, common words and short sentences is easier to decode.',
        help: 'Content should be written as clearly and simply as possible.',
        helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/reading-level',
      },
    },
  ],
};

export default customAxeConfig;

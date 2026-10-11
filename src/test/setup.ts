import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement scrolling; the app scrolls to top on navigation.
window.scrollTo = () => {};

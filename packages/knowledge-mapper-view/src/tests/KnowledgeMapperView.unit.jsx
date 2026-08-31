/**
 * @jest-environment jsdom
 */
import React from 'react';
import { expect, test } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';

import KnowledgeMapperView from '../KnowledgeMapperView';

test('renders with default name', async () => {
    const { getByTestId } = render(<KnowledgeMapperView />);
    expect(getByTestId('greeting')).toHaveTextContent('Hello, User!');
});

test('renders with custom name', async () => {
    const name = 'World';
    const { getByTestId } = render(<KnowledgeMapperView name={name} />);
    expect(getByTestId('greeting')).toHaveTextContent(`Hello, ${name}!`);
});

test('increases counter when button is clicked', async () => {
    const { findByRole, getByTestId } = render(<KnowledgeMapperView />);
    const button = await findByRole('button');
    // fireEvent wraps the state update in act(); a raw DOM .click() does not,
    // so the counter never flushed and the assertion saw the zero-state text.
    fireEvent.click(button);
    expect(getByTestId('message')).toHaveTextContent("You've clicked the button 1 time");
});

test('displays the correct message when counter is zero', async () => {
    const { getByTestId } = render(<KnowledgeMapperView />);
    expect(getByTestId('message')).toHaveTextContent('You should try clicking the button.');
});

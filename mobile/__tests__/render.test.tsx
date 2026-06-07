/**
 * FlowOS mobile - __tests__/render.test.tsx
 * Smoke test proving the RN Jest preset transforms TSX/JSX and can render
 * react-native primitives. (Full-screen/component render tests can be added with
 * @testing-library/react-native + the needed native mocks.)
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, View } from 'react-native';

test('renders react-native primitives', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <View>
        <Text>FlowOS</Text>
      </View>,
    );
  });
  expect(tree?.toJSON()).toBeTruthy();
});

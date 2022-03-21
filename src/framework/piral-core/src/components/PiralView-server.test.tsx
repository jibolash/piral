/**
 * @jest-environment node
 */

import * as React from 'react';
import * as hooks from '../hooks';
import * as routes from './PiralRoutes';
import { render } from 'enzyme';
import { PiralView } from './PiralView';

const StubDashboard: React.FC = () => <div />;
StubDashboard.displayName = 'StubDashboard';

const StubErrorInfo: React.FC = () => <div />;
StubErrorInfo.displayName = 'StubErrorInfo';

const StubLoader: React.FC = () => <div />;
StubLoader.displayName = 'StubLoader';

const StubRouter: React.FC = ({ children }) => <div>{children}</div>;
StubRouter.displayName = 'StubRouter';

const StubLayout: React.FC = ({ children }) => <div>{children}</div>;
StubLayout.displayName = 'StubLayout';

jest.mock('../hooks');
jest.mock('./PiralRoutes');

const state = {
    app: {
        error: undefined,
        loading: true,
    },
    components: {
        ErrorInfo: StubErrorInfo,
        LoadingIndicator: StubLoader,
        Router: StubRouter,
        Layout: StubLayout,
    },
    registry: {
        pages: {},
        extensions: {},
    },
    routes: {},
    provider: undefined,
};

(hooks as any).useGlobalState = (select: any) => select(state);

(routes as any).PiralRoutes = ({ }) => <StubDashboard />;

describe('Portal Module', () => {
    it('In this test window should be undefined', () => {
        state.app.loading = false;
        state.app.error = undefined;
        const node = render(<PiralView />);
        expect(typeof window).toBe("undefined")
        expect(node.length).toBe(1);
    });
});
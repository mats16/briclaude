import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
function App() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(false);
    const checkHealth = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            setHealth(data);
        }
        catch (error) {
            console.error('Health check failed:', error);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        checkHealth();
    }, []);
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-background", children: _jsxs("div", { className: "w-[400px] border rounded-lg shadow-sm bg-card text-card-foreground", children: [_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Claude Code on Databricks" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: "React + Fastify Monorepo" })] }), _jsxs("div", { className: "p-6 pt-0 space-y-4", children: [health && (_jsxs("div", { className: "rounded-lg border p-4", children: [_jsxs("p", { className: "text-sm font-medium", children: ["Status: ", health.status] }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Service: ", health.service] }), _jsxs("p", { className: "text-sm text-muted-foreground", children: ["Time: ", new Date(health.timestamp).toLocaleString()] })] })), _jsx("button", { onClick: checkHealth, disabled: loading, className: "w-full inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50", children: loading ? 'Checking...' : 'Check Health' })] })] }) }));
}
export default App;

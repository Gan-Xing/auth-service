// 管理后台认证辅助函数
(function() {
    // 检查是否有管理员token
    const adminToken = localStorage.getItem('adminToken');
    
    // 如果没有token且不是登录页面，重定向到登录页
    if (!adminToken && !window.location.pathname.includes('/admin/login')) {
        window.location.href = '/admin/login?returnUrl=' + encodeURIComponent(window.location.pathname);
        return;
    }
    
    // 为所有AJAX请求添加认证头
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        let [url, options = {}] = args;
        
        // 如果是管理后台的请求，添加认证头
        if (adminToken && (url.includes('/admin/') || url.includes('/api/'))) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${adminToken}`
            };
        }
        
        return originalFetch.apply(this, [url, options])
            .then(response => {
                // 如果返回401，清除token并重定向到登录页
                if (response.status === 401) {
                    localStorage.removeItem('adminToken');
                    localStorage.removeItem('adminUser');
                    window.location.href = '/admin/login?returnUrl=' + encodeURIComponent(window.location.pathname);
                }
                return response;
            });
    };
    
    // 添加登出功能
    window.adminLogout = function() {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUser');
        window.location.href = '/admin/login';
    };
    
    // 获取当前管理员信息
    window.getCurrentAdmin = function() {
        const adminUser = localStorage.getItem('adminUser');
        return adminUser ? JSON.parse(adminUser) : null;
    };
})();
// 管理员登录页面 JavaScript

// 确保DOM加载完成后再绑定事件
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) {
        console.error('Login form not found');
        return;
    }
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const form = e.target;
        const formData = new FormData(form);
        const loginButton = document.getElementById('loginButton');
        const loading = document.getElementById('loading');
        
        // 清除之前的错误
        clearErrors();
        
        // 显示加载状态
        loginButton.disabled = true;
        loading.classList.remove('hidden');
        
        try {
            const response = await fetch('/admin/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password'),
                    remember: formData.get('remember') === 'on'
                })
            });
            
            let result;
            try {
                const text = await response.text();
                console.log('Login response:', text);
                result = JSON.parse(text);
            } catch (e) {
                console.error('Failed to parse response:', e);
                showError('服务器响应格式错误');
                return;
            }
            
            console.log('Parsed result:', result);
            
            // 检查嵌套的 success 字段
            const isSuccess = result.success || (result.data && result.data.success);
            const data = result.data && result.data.data ? result.data.data : result.data;
            
            if (isSuccess) {
                // 保存token到localStorage
                if (data && data.token) {
                    console.log('Saving token to localStorage');
                    localStorage.setItem('adminToken', data.token);
                    localStorage.setItem('adminUser', JSON.stringify(data.user));
                }
                
                // 显示成功消息
                showSuccess('登录成功，正在跳转...');
                
                // 登录成功，重定向到管理后台
                const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
                setTimeout(() => {
                    window.location.href = returnUrl || '/admin/dashboard';
                }, 1000);
            } else {
                // 显示错误信息
                showError(result.message || '登录失败，请重试');
                
                // 显示字段特定的错误
                if (result.errors) {
                    Object.keys(result.errors).forEach(field => {
                        showFieldError(field, result.errors[field]);
                    });
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('网络错误，请重试');
        } finally {
            // 隐藏加载状态
            loginButton.disabled = false;
            loading.classList.add('hidden');
        }
    });
});

function clearErrors() {
    // 清除字段错误
    document.querySelectorAll('input').forEach(input => {
        input.classList.remove('border-red-300', 'ring-red-500');
        input.classList.add('border-gray-300');
    });
    document.querySelectorAll('[id$="Error"]').forEach(error => {
        error.textContent = '';
    });
    // 清除顶部警告
    document.querySelectorAll('.bg-red-50, .bg-green-50').forEach(alert => {
        if (!alert.textContent.includes('{{')) { // 不删除模板中的错误
            alert.remove();
        }
    });
}

function showError(message) {
    const form = document.getElementById('loginForm');
    const alert = document.createElement('div');
    alert.className = 'mb-5 p-3 bg-red-50 border border-red-200 rounded-lg';
    alert.innerHTML = '<p class="text-red-600 text-sm">' + message + '</p>';
    form.parentNode.insertBefore(alert, form);
}

function showSuccess(message) {
    const form = document.getElementById('loginForm');
    const alert = document.createElement('div');
    alert.className = 'mb-5 p-3 bg-green-50 border border-green-200 rounded-lg';
    alert.innerHTML = '<p class="text-green-600 text-sm">' + message + '</p>';
    form.parentNode.insertBefore(alert, form);
}

function showFieldError(field, message) {
    const fieldElement = document.getElementById(field);
    if (fieldElement) {
        const errorElement = document.getElementById(field + 'Error');
        
        fieldElement.classList.remove('border-gray-300');
        fieldElement.classList.add('border-red-300', 'ring-red-500');
        
        if (errorElement) {
            errorElement.textContent = message;
        }
    }
}

// 自动聚焦到邮箱输入框
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('email').focus();
    
    // 处理回车键
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const activeElement = document.activeElement;
            if (activeElement.id === 'email') {
                document.getElementById('password').focus();
            } else if (activeElement.id === 'password') {
                // 直接调用登录处理函数，而不是触发submit事件
                document.getElementById('loginButton').click();
            }
        }
    });
});
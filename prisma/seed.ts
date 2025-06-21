import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始数据库种子数据初始化...');

  try {
    // 1. 创建默认系统租户（如果不存在）
    let systemTenant = await prisma.tenant.findFirst({
      where: { name: 'System' },
    });

    if (!systemTenant) {
      systemTenant = await prisma.tenant.create({
        data: {
          name: 'System',
          domain: null, // 系统租户没有域名限制
          isActive: true,
        },
      });
      console.log('✅ 创建系统租户:', systemTenant.name);
    } else {
      console.log('ℹ️ 系统租户已存在:', systemTenant.name);
    }

    // 2. 创建默认超级管理员账户（如果不存在）
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@auth-service.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';

    let adminUser = await prisma.user.findFirst({
      where: { 
        email: adminEmail,
        tenantId: systemTenant.id,
      },
    });

    if (!adminUser) {
      // 哈希密码
      const hashedPassword = await bcrypt.hash(adminPassword, 12);

      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Admin',
          username: 'superadmin',
          tenantId: systemTenant.id,
          isActive: true,
          isVerified: true,
        },
      });

      console.log('✅ 创建超级管理员账户:');
      console.log('   邮箱:', adminEmail);
      console.log('   密码:', adminPassword);
      console.log('   ⚠️  请立即修改默认密码！');
    } else {
      console.log('ℹ️ 超级管理员账户已存在:', adminEmail);
    }

    // 3. 创建示例租户（开发环境）
    if (process.env.NODE_ENV === 'development') {
      let exampleTenant = await prisma.tenant.findFirst({
        where: { name: 'Example Corp' },
      });

      if (!exampleTenant) {
        exampleTenant = await prisma.tenant.create({
          data: {
            name: 'Example Corp',
            domain: 'example.com',
            isActive: true,
          },
        });
        console.log('✅ 创建示例租户:', exampleTenant.name);

        // 创建示例用户
        const exampleUserPassword = await bcrypt.hash('User123!', 12);
        const exampleUser = await prisma.user.create({
          data: {
            email: 'user@example.com',
            password: exampleUserPassword,
            firstName: 'John',
            lastName: 'Doe',
            username: 'johndoe',
            tenantId: exampleTenant.id,
            isActive: true,
            isVerified: true,
          },
        });
        console.log('✅ 创建示例用户:', exampleUser.email);
      } else {
        console.log('ℹ️ 示例租户已存在:', exampleTenant.name);
      }
    }

    console.log('🎉 数据库种子数据初始化完成！');
    console.log('\n📋 管理员登录信息:');
    console.log('   URL: http://localhost:3001/admin/login');
    console.log('   邮箱:', adminEmail);
    console.log('   密码:', adminPassword);
    console.log('\n⚠️  重要提醒:');
    console.log('   1. 请立即修改默认管理员密码');
    console.log('   2. 在生产环境中设置 ADMIN_EMAIL 和 ADMIN_PASSWORD 环境变量');

  } catch (error) {
    console.error('❌ 种子数据初始化失败:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
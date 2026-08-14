import * as dotenv from "dotenv";
import * as path from "path";
import * as crypto from "crypto";

// 加载环境变量
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { auth } from "@libs/auth";
import { db } from "./client";
import {
  user,
  account,
  blogPost,
  commission,
  withdrawal,
  order,
  userProfile,
} from "./schema";
import { and, eq } from "drizzle-orm/expressions";
import { getDialect } from "./shared/dialect";

/**
 * 生成用户ID
 */
function generateUserId(): string {
  return `user_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 生成账户ID
 */
function generateAccountId(): string {
  return `account_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * 填充测试数据
 */
async function seedDatabase() {
  const dialect = getDialect();
  try {
    console.log(`⚙️ 开始填充测试数据... (dialect: ${dialect})`);
    
    // 获取 Better Auth 上下文以使用密码哈希功能
    const ctx = await auth.$context;
    
    // 创建管理员用户
    console.log("创建管理员用户...");
    try {
      // 检查管理员是否已存在
      const existingAdmin = await db.select().from(user).where(eq(user.email, "admin@example.com")).limit(1);
      
      if (existingAdmin.length > 0) {
        const now = new Date();
        const adminPasswordHash = await ctx.password.hash("admin123");
        await db.update(user).set({ role: "admin", emailVerified: true, kycVerified: true, updatedAt: now })
          .where(eq(user.id, existingAdmin[0].id));
        const existingCredential = await db.select().from(account).where(and(
          eq(account.userId, existingAdmin[0].id),
          eq(account.providerId, "credential"),
        )).limit(1);
        if (existingCredential.length > 0) {
          await db.update(account).set({ password: adminPasswordHash, updatedAt: now })
            .where(eq(account.id, existingCredential[0].id));
        } else {
          await db.insert(account).values({
            id: generateAccountId(),
            accountId: existingAdmin[0].id,
            providerId: "credential",
            userId: existingAdmin[0].id,
            password: adminPasswordHash,
            createdAt: now,
            updatedAt: now,
          });
        }
        console.log("✓ 管理员用户已存在: admin@example.com");
      } else {
        // 生成密码哈希
        const adminPasswordHash = await ctx.password.hash("admin123");
        const adminUserId = generateUserId();
        
        // 插入管理员用户
        await db.insert(user).values({
          id: adminUserId,
          email: "admin@example.com",
          name: "管理员",
          emailVerified: true,
          role: "admin",
          kycVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        // 插入密码账户记录
        await db.insert(account).values({
          id: generateAccountId(),
          accountId: generateAccountId(),
          providerId: "credential",
          userId: adminUserId,
          password: adminPasswordHash,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log("✓ 已创建管理员用户: admin@example.com");
      }
    } catch (error: any) {
      if (error.message?.includes("UNIQUE constraint") || error.code === "23505") {
        console.log("✓ 管理员用户已存在: admin@example.com");
      } else {
        console.error("❌ 创建管理员失败:", error.message || error);
        return false;
      }
    }

    // 创建普通用户
    console.log("创建普通用户...");
    try {
      // 检查普通用户是否已存在
      const existingUser = await db.select().from(user).where(eq(user.email, "user@example.com")).limit(1);
      
      if (existingUser.length > 0) {
        console.log("✓ 普通用户已存在: user@example.com");
      } else {
        // 生成密码哈希
        const userPasswordHash = await ctx.password.hash("user123456");
        const normalUserId = generateUserId();
        
        // 插入普通用户
        await db.insert(user).values({
          id: normalUserId,
          email: "user@example.com",
          name: "测试用户",
          emailVerified: true,
          role: "user",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
        // 插入密码账户记录
        await db.insert(account).values({
          id: generateAccountId(),
          accountId: generateAccountId(),
          providerId: "credential",
          userId: normalUserId,
          password: userPasswordHash,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log("✓ 已创建普通用户: user@example.com");
      }
    } catch (error: any) {
      if (error.message?.includes("UNIQUE constraint") || error.code === "23505") {
        console.log("✓ 普通用户已存在: user@example.com");
      } else {
        console.error("❌ 创建普通用户失败:", error.message || error);
        return false;
      }
    }

    // 创建可直接进入 VibeChat 的聊天测试用户
    console.log("创建聊天测试用户...");
    const chatTestUsers = [
      {
        email: "alice@vibechat.test",
        password: "VibeChatTest2026!",
        name: "Alice Chen",
        username: "alice",
      },
      {
        email: "bob@vibechat.test",
        password: "VibeChatTest2026!",
        name: "Bob Li",
        username: "bob",
      },
      {
        email: "carol@vibechat.test",
        password: "VibeChatTest2026!",
        name: "Carol Wang",
        username: "carol",
      },
    ] as const;

    for (const testUser of chatTestUsers) {
      try {
        const existingUsers = await db
          .select()
          .from(user)
          .where(eq(user.email, testUser.email))
          .limit(1);
        const now = new Date();
        const userId = existingUsers[0]?.id || generateUserId();
        const passwordHash = await ctx.password.hash(testUser.password);

        if (existingUsers.length === 0) {
          await db.insert(user).values({
            id: userId,
            email: testUser.email,
            name: testUser.name,
            emailVerified: true,
            role: "user",
            createdAt: now,
            updatedAt: now,
          });

          await db.insert(account).values({
            id: generateAccountId(),
            accountId: userId,
            providerId: "credential",
            userId,
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await db
            .update(user)
            .set({
              name: testUser.name,
              emailVerified: true,
              updatedAt: now,
            })
            .where(eq(user.id, userId));

          const existingAccounts = await db
            .select()
            .from(account)
            .where(and(
              eq(account.userId, userId),
              eq(account.providerId, "credential"),
            ))
            .limit(1);

          if (existingAccounts.length === 0) {
            await db.insert(account).values({
              id: generateAccountId(),
              accountId: userId,
              providerId: "credential",
              userId,
              password: passwordHash,
              createdAt: now,
              updatedAt: now,
            });
          } else {
            await db
              .update(account)
              .set({ password: passwordHash, updatedAt: now })
              .where(eq(account.id, existingAccounts[0].id));
          }
        }

        const existingProfiles = await db
          .select()
          .from(userProfile)
          .where(eq(userProfile.userId, userId))
          .limit(1);

        if (existingProfiles.length === 0) {
          await db.insert(userProfile).values({
            userId,
            username: testUser.username,
            displayName: testUser.name,
            avatarUrl: null,
            onboardingCompletedAt: now,
            status: "active",
            createdAt: now,
            updatedAt: now,
          });
        } else {
          await db
            .update(userProfile)
            .set({
              username: testUser.username,
              displayName: testUser.name,
              onboardingCompletedAt:
                existingProfiles[0].onboardingCompletedAt || now,
              status: "active",
              updatedAt: now,
            })
            .where(eq(userProfile.userId, userId));
        }

        console.log(`✓ 聊天测试用户可用: ${testUser.email} (@${testUser.username})`);
      } catch (error: any) {
        console.error(
          `❌ 创建聊天测试用户失败 (${testUser.email}):`,
          error.message || error,
        );
        return false;
      }
    }

    // Recreate a genuinely blank account on every seed. Recreating the user gives
    // Matrix provisioning a fresh localpart as well, so rooms from a previous test
    // run cannot reappear after the account is reset.
    console.log("重置全白测试用户...");
    try {
      const blankEmail = "blank@vibechat.test";
      const blankPassword = "VibeChatTest2026!";
      const existingBlankUsers = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, blankEmail));

      for (const existingBlankUser of existingBlankUsers) {
        await db.delete(user).where(eq(user.id, existingBlankUser.id));
      }

      const now = new Date();
      const blankUserId = generateUserId();
      const blankPasswordHash = await ctx.password.hash(blankPassword);
      await db.insert(user).values({
        id: blankUserId,
        email: blankEmail,
        name: "Blank User",
        emailVerified: true,
        role: "user",
        kycVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(account).values({
        id: generateAccountId(),
        accountId: blankUserId,
        providerId: "credential",
        userId: blankUserId,
        password: blankPasswordHash,
        createdAt: now,
        updatedAt: now,
      });
      await db.insert(userProfile).values({
        userId: blankUserId,
        username: `blank_${blankUserId.slice(-8)}`,
        displayName: "Blank User",
        avatarUrl: null,
        onboardingCompletedAt: now,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      console.log(`✓ 全白测试用户已重置: ${blankEmail} (全新 Matrix localpart)`);
    } catch (error: any) {
      console.error("❌ 重置全白测试用户失败:", error.message || error);
      return false;
    }
    
    // 创建博客文章
    console.log("创建博客文章...");
    try {
      const adminUser = await db.select().from(user).where(eq(user.email, "admin@example.com")).limit(1);
      if (adminUser.length > 0) {
        const adminId = adminUser[0].id;
        const existingPosts = await db.select({ id: blogPost.id }).from(blogPost).limit(1);

        if (existingPosts.length > 0) {
          console.log("✓ 博客文章已存在，跳过创建");
        } else {
          await db.insert(blogPost).values([
            {
              id: crypto.randomUUID(),
              title: "Getting Started with Vibe Chat",
              slug: "getting-started-with-vibechat",
              content: "# Getting Started\n\nWelcome to **Vibe Chat**! This is a modern SaaS starter kit.\n\n## Features\n\n- Next.js & Nuxt.js support\n- Authentication\n- Payment integration\n\n```javascript\nconsole.log(\"Hello Vibe Chat!\");\n```\n\nEnjoy building your SaaS!",
              coverImage: "https://static.vikingz.me/uploads/m7i5mVxdOw0oP8Y6iIPfpGgHJK5i1VVd/1773209769094-z7o70l.png",
              excerpt: "Learn how to get started with Vibe Chat, the modern SaaS development platform.",
              authorId: adminId,
              status: "published",
              publishedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            {
              id: crypto.randomUUID(),
              title: "Draft Post - Coming Soon",
              slug: "draft-post-coming-soon",
              content: "# Coming Soon\n\nThis post is still being written.",
              excerpt: "This is a draft post that should not appear on the public blog.",
              authorId: adminId,
              status: "draft",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]);
          console.log("✓ 已创建示例博客文章（1 篇已发布，1 篇草稿）");
        }
      } else {
        console.log("⚠ 未找到管理员用户，跳过博客文章创建");
      }
    } catch (error: any) {
      if (error.code === "23505" || error.message?.includes("UNIQUE constraint")) {
        console.log("✓ 博客文章已存在，跳过创建");
      } else {
        console.error("❌ 创建博客文章失败:", error.message || error);
      }
    }

    // Create affiliate test data (referral users, commissions, withdrawals)
    console.log("创建推广返利测试数据...");
    try {
      const adminUser = await db.select().from(user).where(eq(user.email, "admin@example.com")).limit(1);
      const normalUser = await db.select().from(user).where(eq(user.email, "user@example.com")).limit(1);

      if (adminUser.length > 0 && normalUser.length > 0) {
        const referrerUser = adminUser[0];
        const referrerCode = "ADMIN_REF_2024";

        // Set referral code on admin user
        await db.update(user).set({
          referralCode: referrerCode,
          commissionBalance: "125.50",
        }).where(eq(user.id, referrerUser.id));

        // Create 3 referred test users
        const referredUsers: { id: string; email: string; name: string }[] = [];
        for (let i = 1; i <= 3; i++) {
          const email = `referred${i}@example.com`;
          const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
          if (existing.length > 0) {
            referredUsers.push({ id: existing[0].id, email, name: existing[0].name || `Referred User ${i}` });
            continue;
          }
          const refUserId = generateUserId();
          const refPasswordHash = await ctx.password.hash("test123456");
          await db.insert(user).values({
            id: refUserId,
            email,
            name: `Referred User ${i}`,
            emailVerified: true,
            role: "user",
            referredByCode: referrerCode,
            createdAt: new Date(Date.now() - (4 - i) * 86400000 * 7),
            updatedAt: new Date(),
          });
          await db.insert(account).values({
            id: generateAccountId(),
            accountId: generateAccountId(),
            providerId: "credential",
            userId: refUserId,
            password: refPasswordHash,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          referredUsers.push({ id: refUserId, email, name: `Referred User ${i}` });
        }

        // Create test orders + commissions for each referred user
        for (let i = 0; i < referredUsers.length; i++) {
          const refUser = referredUsers[i];
          const orderId = `order_affiliate_test_${i + 1}`;
          const commissionId = `comm_affiliate_test_${i + 1}`;
          const orderAmount = [99.0, 199.0, 49.0][i];
          const commRate = 0.1;
          const commAmount = orderAmount * commRate;
          const statuses = ["credited", "credited", "pending"] as const;

          // Create order if not exists
          const existingOrder = await db.select().from(order).where(eq(order.id, orderId)).limit(1);
          if (existingOrder.length === 0) {
            await db.insert(order).values({
              id: orderId,
              userId: refUser.id,
              amount: String(orderAmount),
              currency: "USD",
              planId: "pro_monthly",
              status: "paid",
              provider: "stripe",
              providerOrderId: `stripe_test_${i + 1}`,
              createdAt: new Date(Date.now() - (3 - i) * 86400000 * 5),
              updatedAt: new Date(),
            });
          }

          // Create commission if not exists
          const existingComm = await db.select().from(commission).where(eq(commission.id, commissionId)).limit(1);
          if (existingComm.length === 0) {
            await db.insert(commission).values({
              id: commissionId,
              referrerId: referrerUser.id,
              orderId,
              buyerId: refUser.id,
              orderAmount: String(orderAmount),
              currency: "USD",
              commissionRate: String(commRate),
              commissionAmount: String(commAmount),
              status: statuses[i],
              createdAt: new Date(Date.now() - (3 - i) * 86400000 * 5),
              updatedAt: new Date(),
            });
          }
        }

        // Create test withdrawal requests
        const withdrawalData = [
          { id: "wd_test_1", amount: "50.00", method: "alipay", account: "admin@alipay.com", status: "completed", processedAt: new Date() },
          { id: "wd_test_2", amount: "25.50", method: "paypal", account: "admin@paypal.com", status: "pending", processedAt: null },
        ];
        for (const wd of withdrawalData) {
          const existing = await db.select().from(withdrawal).where(eq(withdrawal.id, wd.id)).limit(1);
          if (existing.length === 0) {
            await db.insert(withdrawal).values({
              id: wd.id,
              userId: referrerUser.id,
              amount: wd.amount,
              currency: "USD",
              paymentMethod: wd.method,
              paymentAccount: wd.account,
              status: wd.status,
              processedAt: wd.processedAt,
              processedBy: wd.status === "completed" ? referrerUser.id : null,
              adminNote: wd.status === "completed" ? "Test withdrawal approved" : null,
              createdAt: new Date(Date.now() - 86400000 * 3),
              updatedAt: new Date(),
            });
          }
        }

        console.log("✓ 已创建推广返利测试数据 (3 个邀请用户, 3 条佣金记录, 2 条提现记录)");
      } else {
        console.log("⚠ 未找到管理员或普通用户，跳过推广返利数据创建");
      }
    } catch (error: any) {
      if (error.code === "23505" || error.message?.includes("UNIQUE constraint")) {
        console.log("✓ 推广返利测试数据已存在，跳过创建");
      } else {
        console.error("❌ 创建推广返利测试数据失败:", error.message || error);
      }
    }

    // Create sample pricing plans (dynamic pricing)
    console.log("创建示例动态定价方案...");
    try {
      const { pricingPlan } = await import("./schema");
      const existingPlans = await db.select({ id: pricingPlan.id }).from(pricingPlan).limit(1);

      if (existingPlans.length > 0) {
        console.log("✓ 定价方案已存在，跳过创建");
      } else {
        const now = new Date();
        await db.insert(pricingPlan).values([
          {
            id: "seed_monthly",
            provider: "stripe",
            amount: "10.00",
            originalPrice: null,
            currency: "USD",
            durationType: "recurring",
            durationMonths: 1,
            credits: null,
            recommended: false,
            sortOrder: 1,
            isActive: true,
            locales: null,
            stripePriceId: "price_monthly_example",
            i18n: {
              en: {
                name: "Monthly Plan",
                description: "Monthly recurring subscription",
                duration: "month",
                features: ["All premium features", "Priority support"],
              },
              "zh-CN": {
                name: "月度订阅",
                description: "月度循环订阅",
                duration: "月",
                features: ["所有高级功能", "优先支持"],
              },
            },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "seed_lifetime",
            provider: "stripe",
            amount: "499.00",
            originalPrice: "999.00",
            currency: "USD",
            durationType: "one_time",
            durationMonths: 999999,
            credits: null,
            recommended: true,
            sortOrder: 2,
            isActive: true,
            locales: null,
            stripePriceId: "price_lifetime_example",
            i18n: {
              en: {
                name: "Lifetime",
                description: "Pay once, use forever",
                duration: "lifetime",
                features: ["All premium features", "Free lifetime updates", "Priority support"],
              },
              "zh-CN": {
                name: "终身会员",
                description: "一次付费，永久使用",
                duration: "终身",
                features: ["所有高级功能", "终身免费更新", "优先支持"],
              },
            },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "seed_wechat_monthly",
            provider: "wechat",
            amount: "29.90",
            originalPrice: null,
            currency: "CNY",
            durationType: "one_time",
            durationMonths: 1,
            credits: null,
            recommended: false,
            sortOrder: 3,
            isActive: true,
            locales: ["zh-CN"],
            i18n: {
              en: {
                name: "Monthly (WeChat)",
                description: "Monthly access via WeChat Pay",
                duration: "month",
                features: ["All premium features", "Priority support"],
              },
              "zh-CN": {
                name: "微信月度会员",
                description: "微信支付月度方案",
                duration: "月",
                features: ["全部高级功能", "优先客服支持"],
              },
            },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "seed_credits_100",
            provider: "stripe",
            amount: "5.00",
            originalPrice: null,
            currency: "USD",
            durationType: "credits",
            durationMonths: null,
            credits: 100,
            recommended: false,
            sortOrder: 10,
            isActive: true,
            locales: null,
            stripePriceId: "price_credits_100_example",
            i18n: {
              en: {
                name: "100 Credits",
                description: "Purchase 100 AI credits",
                duration: "one-time",
                features: ["100 AI credits", "Never expire", "Pay as you go"],
              },
              "zh-CN": {
                name: "100 积分包",
                description: "购买 100 个 AI 积分",
                duration: "一次性",
                features: ["100 AI 积分", "永不过期", "按需付费"],
              },
            },
            createdAt: now,
            updatedAt: now,
          },
          {
            id: "seed_credits_wechat",
            provider: "wechat",
            amount: "19.90",
            originalPrice: null,
            currency: "CNY",
            durationType: "credits",
            durationMonths: null,
            credits: 200,
            recommended: true,
            sortOrder: 11,
            isActive: true,
            locales: ["zh-CN"],
            i18n: {
              en: {
                name: "200 Credits (WeChat)",
                description: "Top up credits via WeChat Pay",
                duration: "one-time",
                features: ["200 AI credits", "Never expire"],
              },
              "zh-CN": {
                name: "200 积分包",
                description: "微信支付充值积分",
                duration: "一次性",
                features: ["200 AI 积分", "永不过期", "微信扫码支付"],
              },
            },
            createdAt: now,
            updatedAt: now,
          },
        ]);
        console.log("✓ 已创建 5 个示例定价方案 (订阅×1 + 终身×1 + 微信月度×1 + 积分包×2)");
      }
    } catch (error: any) {
      if (error.code === "23505" || error.message?.includes("UNIQUE constraint")) {
        console.log("✓ 定价方案已存在，跳过创建");
      } else {
        console.error("❌ 创建定价方案失败:", error.message || error);
      }
    }

    console.log("\n✅ 数据填充完成!");
    console.log("测试账户信息:");
    console.log("管理员 - 邮箱: admin@example.com, 密码: admin123");
    console.log("普通用户 - 邮箱: user@example.com, 密码: user123456");
    console.log("邀请用户 - 邮箱: referred1-3@example.com, 密码: test123456");
    console.log("聊天用户 - 邮箱: alice/bob/carol@vibechat.test, 密码: VibeChatTest2026!");
    console.log("全白用户 - 邮箱: blank@vibechat.test, 密码: VibeChatTest2026!");
    
    return true;
  } catch (error) {
    console.error("❌ 数据填充过程中发生错误:", error);
    return false;
  }
}

// 如果直接运行此文件，执行数据填充
if (require.main === module) {
  seedDatabase()
    .then((success) => {
      if (!success) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("发生错误:", error);
      process.exit(1);
    });
}

export { seedDatabase };

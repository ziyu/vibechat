import { User, CreditCard, ShoppingCart, LayoutDashboard, Coins, FileText, DollarSign, Wallet, Tag, ArrowUpRight } from "lucide-react"
import { useTranslation } from "@/hooks/use-translation"
import { useRouterState } from "@tanstack/react-router"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@vibechat/react-shared/ui/sidebar"

export function AppSidebar() {
  const { t } = useTranslation()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const dashboardItem = {
    title: t.navigation.admin.dashboard,
    url: `/admin`,
    icon: LayoutDashboard,
  }

  const items = [
    {
      title: t.navigation.admin.users,
      url: `/admin/users`,
      icon: User,
    },
    {
      title: t.navigation.admin.subscriptions,
      url: `/admin/subscriptions`,
      icon: CreditCard,
    },
    {
      title: t.navigation.admin.orders,
      url: `/admin/orders`,
      icon: ShoppingCart,
    },
    {
      title: t.navigation.admin.credits,
      url: `/admin/credits`,
      icon: Coins,
    },
    {
      title: t.navigation.admin.pricing || 'Pricing',
      url: `/admin/pricing`,
      icon: Tag,
    },
    {
      title: t.navigation.admin.blog,
      url: `/admin/blog`,
      icon: FileText,
    },
    {
      title: t.navigation.admin.commissions,
      url: `/admin/commissions`,
      icon: DollarSign,
    },
    {
      title: t.navigation.admin.withdrawals,
      url: `/admin/withdrawals`,
      icon: Wallet,
    },
  ]

  return (
    <Sidebar className="admin-sidebar">
      <SidebarHeader className="admin-sidebar-header">
        <a href="/admin" className="admin-wordmark">
          <img src="/logo.svg" alt="" />
          <span><strong>{t.adminApp.name}</strong><small>{t.adminApp.workspace}</small></span>
        </a>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === dashboardItem.url}>
                  <a href={dashboardItem.url}>
                    <dashboardItem.icon />
                    <span>{dashboardItem.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarGroup>
          <SidebarGroupLabel>{t.navigation.admin.application}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <div className="admin-sidebar-footer">
        <a href={`${import.meta.env.VITE_WEB_APP_ORIGIN || 'http://localhost:8001'}/messages`}>
          <span>{t.adminApp.openProduct}</span><ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </Sidebar>
  )
}

import type { Locale } from './types'

export const en: Locale = {
  common: {
    welcome: "Welcome to Vibe Chat",
    siteName: "Vibe Chat",
    login: "Login",
    signup: "Sign Up",
    logout: "Logout",
    profile: "Profile",
    settings: "Settings",
    and: "and",
    loading: "Loading...",
    unexpectedError: "An unexpected error occurred",
    notAvailable: "N/A",
    viewPlans: "View Plans",
    yes: "Yes",
    no: "No",
    pageNotFound: {
      documentTitle: "Vibe Chat - Page Not Found",
      eyebrow: "404 / Page not found",
      title: "This page doesn't exist.",
      description: "The link may be outdated, or the page may have moved. Your language preference and account data are unchanged.",
      backHome: "Back to home"
    },
    theme: {
      light: "Light Theme",
      dark: "Dark Theme",
      system: "System Theme",
      toggle: "Toggle Theme",
      appearance: "Appearance",
      colorScheme: "Color Scheme",
      themes: {
        default: "Default",
        claude: "Claude",
        "cosmic-night": "Cosmic Night",
        "modern-minimal": "Modern Minimal",
        "ocean-breeze": "Ocean Breeze"
      }
    }
  },
  navigation: {
    home: "Home",
    dashboard: "Dashboard",
    orders: "Orders",
    shipments: "Shipments",
    tracking: "Tracking",
    admin: {
      dashboard: "Dashboard",
      users: "Users",
      subscriptions: "Subscriptions",
      orders: "Orders",
      credits: "Credits",
      pricing: "Pricing",
      application: "Application",
      blog: "Blog",
      commissions: "Commissions",
      withdrawals: "Withdrawals"
    }
  },
  actions: {
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    delete: "Delete",
    edit: "Edit",
    tryAgain: "Try again",
    createAccount: "Create account",
    sendCode: "Send Code",
    verify: "Verify",
    backToList: "Back to Users",
    saveChanges: "Save Changes",
    createUser: "Create User",
    deleteUser: "Delete User",
    back: "Back",
    resendCode: "Resend Code",
    resendVerificationEmail: "Resend Verification Email",
    upload: "Upload",
    previous: "Previous",
    next: "Next",
    createPost: "New Post",
    deletePost: "Delete Post",
    backToBlog: "Back to Blog"
  },
  email: {
    verification: {
      subject: "Verify your Vibe Chat account",
      title: "Verify your email address",
      greeting: "Hello {{name}},",
      message: "Thank you for registering with Vibe Chat. To complete your registration, please click the button below to verify your email address.",
      button: "Verify Email Address",
      alternativeText: "Or, copy and paste the following link into your browser:",
      expiry: "This link will expire in {{expiry_hours}} hours.",
      disclaimer: "If you didn't request this verification, please ignore this email.",
      signature: "The Vibe Chat Team",
    copyright: "© {{year}} Vibe Chat. All rights reserved."
    },
    resetPassword: {
      subject: "Reset your Vibe Chat password",
      title: "Reset your password",
      greeting: "Hello {{name}},",
      message: "We received a request to reset your password. Please click the button below to create a new password. If you didn't make this request, you can safely ignore this email.",
      button: "Reset Password",
      alternativeText: "Or, copy and paste the following link into your browser:",
      expiry: "This link will expire in {{expiry_hours}} hours.",
      disclaimer: "If you didn't request a password reset, no action is required.",
      signature: "The Vibe Chat Team",
      copyright: "© {{year}} Vibe Chat. All rights reserved."
    },
    authenticationOtp: {
      subject: "Your Vibe Chat verification code",
      title: "Your verification code",
      signInMessage: "Use this code to sign in to Vibe Chat. If this email is new, your account will be created automatically.",
      emailVerificationMessage: "Use this code to verify your Vibe Chat email address.",
      passwordResetMessage: "Use this code to continue resetting your Vibe Chat password.",
      codeLabel: "Verification code",
      expiry: "This code expires in {{expiry_minutes}} minutes.",
      disclaimer: "Never share this code. If you didn't request it, you can safely ignore this email.",
      signature: "The Vibe Chat Team",
      copyright: "© {{year}} Vibe Chat. All rights reserved."
    }
  },
  auth: {
    metadata: {
      signin: {
        title: "Vibe Chat - Sign In",
        description: "Sign in to reconnect with your conversations, contacts, and atmosphere spaces.",
        keywords: "sign in, login, authentication, account access, dashboard"
      },
      signup: {
        title: "Vibe Chat - Create Account",
        description: "Create your Vibe Chat account and give every conversation an atmosphere of its own.",
        keywords: "sign up, register, create account, new user, get started"
      },
      forgotPassword: {
        title: "Vibe Chat - Reset Password",
        description: "Reset your Vibe Chat account password securely. Enter your email to receive password reset instructions.",
        keywords: "forgot password, reset password, password recovery, account recovery"
      },
      resetPassword: {
        title: "Vibe Chat - Create New Password",
        description: "Create a new secure password for your Vibe Chat account. Choose a strong password to protect your account.",
        keywords: "new password, password reset, secure password, account security"
      },
      phone: {
        title: "Vibe Chat - Phone Login",
        description: "Sign in to Vibe Chat using your phone number. Quick and secure authentication with SMS verification.",
        keywords: "phone login, SMS verification, mobile authentication, phone number"
      },
      wechat: {
        title: "Vibe Chat - WeChat Login",
        description: "Sign in to Vibe Chat using your WeChat account. Convenient authentication for Chinese users.",
        keywords: "WeChat login, 微信登录, social login, Chinese authentication"
      }
    },
    signin: {
      title: "Sign in to your account",
      welcomeBack: "Welcome back",
      socialLogin: "Sign in with your favorite social account",
      continueWith: "Or continue with",
      email: "Email",
      emailPlaceholder: "Enter your email",
      password: "Password",
      forgotPassword: "Forgot password?",
      rememberMe: "Remember me",
      submit: "Sign in",
      submitting: "Signing in...",
      otpTitle: "Email code",
      otpDescription: "We'll email you a one-time code. New email addresses are registered automatically.",
      otpCode: "Verification code",
      otpCodePlaceholder: "Enter the 6-digit code",
      sendOtp: "Send code",
      sendingOtp: "Sending code...",
      verifyOtp: "Continue",
      verifyingOtp: "Verifying...",
      otpSent: "We sent a code to {{email}}.",
      resendOtp: "Send a new code",
      changeEmail: "Use another email",
      usePasswordInstead: "Use password instead",
      useEmailOtpInstead: "Use email code instead",
      noAccount: "Don't have an account?",
      signupLink: "Sign up",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      socialProviders: {
        google: "Google",
        github: "GitHub",
        apple: "Apple",
        wechat: "WeChat",
        phone: "Phone"
      },
      errors: {
        invalidEmail: "Please enter a valid email",
        requiredEmail: "Email is required",
        requiredPassword: "Password is required",
        invalidCredentials: "Invalid email or password",
        invalidOtp: "The verification code is invalid or expired",
        otpSendFailed: "We couldn't send a verification code. Please try again.",
        captchaRequired: "Please complete the captcha verification",
        emailNotVerified: {
          title: "Email verification required",
          description: "Please check your email and click the verification link. If you haven't received the email, click the button below to resend.",
          resendSuccess: "Verification email has been resent, please check your inbox.",
          resendError: "Failed to resend verification email, please try again later.",
          dialogTitle: "Resend Verification Email",
          dialogDescription: "Please complete the captcha verification before resending the verification email",
          emailLabel: "Email Address",
          sendButton: "Send Verification Email",
          sendingButton: "Sending...",
          waitButton: "Wait {seconds}s"
        }
      }
    },
    signup: {
      title: "Sign up for Vibe Chat",
      createAccount: "Create an account",
      socialSignup: "Sign up with your favorite social account",
      continueWith: "Or continue with",
      name: "Name",
      namePlaceholder: "Enter your name",
      email: "Email",
      emailPlaceholder: "Enter your email",
      password: "Password",
      passwordPlaceholder: "Create a password",
      imageUrl: "Profile Image URL",
      imageUrlPlaceholder: "https://example.com/your-image.jpg",
      optional: "Optional",
      submit: "Create account",
      submitting: "Creating account...",
      haveAccount: "Already have an account?",
      signinLink: "Sign in",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      verification: {
        title: "Verification Required",
        sent: "We've sent a verification email to",
        checkSpam: "Can't find the email? Please check your spam folder.",
        spamInstruction: "If you still don't see it,"
      },
      errors: {
        invalidName: "Please enter a valid name",
        requiredName: "Name is required",
        invalidEmail: "Please enter a valid email",
        requiredEmail: "Email is required",
        invalidPassword: "Please enter a valid password",
        requiredPassword: "Password is required",
        invalidImage: "Please enter a valid image URL",
        captchaRequired: "Please complete the captcha verification",
        captchaError: "Captcha verification failed, please try again",
        captchaExpired: "Captcha verification expired, please try again"
      }
    },
    phone: {
      title: "Login with Phone",
      description: "Enter your phone number to receive a verification code",
      phoneNumber: "Phone Number",
      phoneNumberPlaceholder: "Enter your phone number",
      countryCode: "Country/Region",
      verificationCode: "Verification Code",
      enterCode: "Enter Verification Code",
      sendingCode: "Sending code...",
      verifying: "Verifying...",
      codeSentTo: "Verification code sent to",
      resendIn: "Resend in",
      seconds: "seconds",
      resendCode: "Resend Code",
      resendCountdown: "seconds remaining",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      errors: {
        invalidPhone: "Please enter a valid phone number",
        requiredPhone: "Phone number is required",
        requiredCountryCode: "Please select country/region",
        invalidCode: "Please enter a valid verification code",
        requiredCode: "Verification code is required",
        captchaRequired: "Please complete the captcha verification"
      }
    },
    forgetPassword: {
      title: "Forgot Password",
      description: "Reset your password and regain access to your account",
      email: "Email",
      emailPlaceholder: "Enter your email",
      submit: "Send reset link",
      submitting: "Sending...",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      verification: {
        title: "Check your email",
        sent: "We've sent a password reset link to",
        checkSpam: "Can't find the email? Please check your spam folder."
      },
      errors: {
        invalidEmail: "Please enter a valid email",
        requiredEmail: "Email is required",
        captchaRequired: "Please complete the captcha verification"
      }
    },
    resetPassword: {
      title: "Reset Password",
      description: "Create a new password for your account",
      password: "New Password",
      passwordPlaceholder: "Enter your new password",
      confirmPassword: "Confirm Password",
      confirmPasswordPlaceholder: "Confirm your new password",
      submit: "Reset Password",
      submitting: "Resetting...",
      success: {
        title: "Password Reset Successful",
        description: "Your password has been successfully reset.",
        backToSignin: "Back to Sign In",
        goToSignIn: "Back to Sign In"
      },
      errors: {
        invalidPassword: "Password must be at least 8 characters",
        requiredPassword: "Password is required",
        passwordsDontMatch: "Passwords don't match",
        invalidToken: "Invalid or expired reset link. Please try again."
      }
    },
    wechat: {
      title: "WeChat Login",
      description: "Scan with WeChat to log in",
      scanQRCode: "Please scan the QR code with WeChat",
      orUseOtherMethods: "Or use other login methods",
      loadingQRCode: "Loading QR code...",
      termsNotice: "By clicking continue, you agree to our",
      termsOfService: "Terms of Service",
      privacyPolicy: "Privacy Policy",
      errors: {
        loadingFailed: "Failed to load WeChat QR code",
        networkError: "Network error, please try again"
      }
    },
    // Auth error codes mapping for Better Auth 1.4
    authErrors: {
      // User errors
      USER_NOT_FOUND: "No account found with this email",
      USER_ALREADY_EXISTS: "User with this email already exists",
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "User already exists. Please use another email",
      USER_EMAIL_NOT_FOUND: "User email not found",
      FAILED_TO_CREATE_USER: "Failed to create user",
      FAILED_TO_UPDATE_USER: "Failed to update user",
      
      // Authentication errors
      INVALID_EMAIL: "Invalid email address",
      INVALID_PASSWORD: "Invalid password",
      INVALID_EMAIL_OR_PASSWORD: "Invalid email or password",
      INVALID_CREDENTIALS: "Invalid credentials provided",
      INVALID_TOKEN: "Invalid or expired token",
      PASSWORD_TOO_SHORT: "Password is too short",
      PASSWORD_TOO_LONG: "Password is too long",
      
      // Email verification errors
      EMAIL_NOT_VERIFIED: "Please verify your email address",
      EMAIL_ALREADY_VERIFIED: "Email is already verified",
      EMAIL_MISMATCH: "Email mismatch",
      EMAIL_CAN_NOT_BE_UPDATED: "Email cannot be updated",
      VERIFICATION_EMAIL_NOT_ENABLED: "Verification email is not enabled",
      
      // Session errors
      SESSION_EXPIRED: "Your session has expired. Please sign in again",
      SESSION_NOT_FRESH: "Session is not fresh. Please re-authenticate",
      FAILED_TO_CREATE_SESSION: "Failed to create session",
      FAILED_TO_GET_SESSION: "Failed to get session",
      
      // Account errors
      ACCOUNT_NOT_FOUND: "Account not found",
      ACCOUNT_BLOCKED: "Your account has been temporarily blocked",
      CREDENTIAL_ACCOUNT_NOT_FOUND: "Credential account not found",
      SOCIAL_ACCOUNT_ALREADY_LINKED: "Social account is already linked",
      LINKED_ACCOUNT_ALREADY_EXISTS: "Linked account already exists",
      FAILED_TO_UNLINK_LAST_ACCOUNT: "Cannot unlink your last account",
      USER_ALREADY_HAS_PASSWORD: "User already has a password",
      
      // Phone number errors
      PHONE_NUMBER_ALREADY_EXISTS: "Phone number is already registered",
      INVALID_PHONE_NUMBER: "Invalid phone number format",
      OTP_EXPIRED: "Verification code has expired",
      INVALID_OTP: "Invalid verification code",
      OTP_TOO_MANY_ATTEMPTS: "Too many verification attempts. Please request a new code",
      
      // Provider errors
      PROVIDER_NOT_FOUND: "Provider not found",
      ID_TOKEN_NOT_SUPPORTED: "ID token not supported",
      FAILED_TO_GET_USER_INFO: "Failed to get user info",
      
      // Security errors
      CAPTCHA_REQUIRED: "Please complete the captcha verification",
      CAPTCHA_INVALID: "Captcha verification failed",
      TOO_MANY_REQUESTS: "Too many requests. Please try again later",
      CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: "Cross-site navigation login blocked",
      INVALID_ORIGIN: "Invalid origin",
      MISSING_OR_NULL_ORIGIN: "Missing or invalid origin",
      
      // Callback URL errors
      INVALID_CALLBACK_URL: "Invalid callback URL",
      INVALID_REDIRECT_URL: "Invalid redirect URL",
      INVALID_ERROR_CALLBACK_URL: "Invalid error callback URL",
      INVALID_NEW_USER_CALLBACK_URL: "Invalid new user callback URL",
      CALLBACK_URL_REQUIRED: "Callback URL is required",
      
      // Validation errors
      VALIDATION_ERROR: "Validation error",
      MISSING_FIELD: "Required field is missing",
      FIELD_NOT_ALLOWED: "Field is not allowed",
      ASYNC_VALIDATION_NOT_SUPPORTED: "Async validation is not supported",
      
      // System errors
      FAILED_TO_CREATE_VERIFICATION: "Failed to create verification",
      EMAIL_SEND_FAILED: "Failed to send email. Please try again later",
      SMS_SEND_FAILED: "Failed to send SMS. Please try again later",
      UNKNOWN_ERROR: "An unexpected error occurred"
    }
  },
  adminApp: {
    name: "Vibe Control",
    workspace: "Operations workspace",
    environment: "Live operations",
    secureWorkspace: "Restricted workspace",
    openProduct: "Open product",
    signInTitle: "Administrator sign-in required",
    signInDescription: "Opening the Vibe Chat sign-in page. Your session will return to this operations workspace.",
    openSignIn: "Open sign-in",
    forbiddenTitle: "Administrator access required",
    forbiddenDescription: "This account is signed in but does not have permission to access operations data.",
  },
  admin: {
    metadata: {
      title: "Vibe Chat - Admin Dashboard",
      description: "Comprehensive admin dashboard for managing users, subscriptions, orders, and system analytics in your SaaS application.",
      keywords: "admin, dashboard, management, SaaS, analytics, users, subscriptions, orders"
    },
    dashboard: {
      title: "Admin Dashboard",
      accessDenied: "Access Denied",
      noPermission: "You don't have permission to access the admin dashboard",
      lastUpdated: "Last updated",
      metrics: {
        totalRevenue: "Total Revenue",
        totalRevenueDesc: "All time revenue",
        newCustomers: "Monthly New Customers",
        newCustomersDesc: "New customers this month",
        newOrders: "Monthly New Orders",
        newOrdersDesc: "New orders this month",
        fromLastMonth: "from last month"
      },
      chart: {
        monthlyRevenueTrend: "Monthly Revenue Trend",
        revenue: "Revenue",
        orders: "Orders"
      },
      todayData: {
        title: "Today's Data",
        revenue: "Revenue",
        newUsers: "New Users",
        orders: "Orders"
      },
      monthData: {
        title: "This Month's Data",
        revenue: "Monthly Revenue",
        newUsers: "Monthly New Users",
        orders: "Monthly Orders"
      },
      recentOrders: {
        title: "Recent Orders",
        orderId: "Order ID",
        customer: "Customer",
        plan: "Plan",
        amount: "Amount",
        provider: "Payment Method",
        status: "Status",
        time: "Time",
        total: "Total"
      }
    },
    users: {
      title: "User Management",
      subtitle: "Manage users, roles, and permissions",
      actions: {
        addUser: "Add User",
        editUser: "Edit User",
        deleteUser: "Delete User",
        banUser: "Ban User",
        unbanUser: "Unban User"
      },
      table: {
        columns: {
          id: "ID",
          name: "Name",
          email: "Email",
          role: "Role",
          phoneNumber: "Phone Number",
          emailVerified: "Email Verified",
          banned: "Banned",
          referralCode: "Referral Code",
          referredByCode: "Referred By",
          commissionBalance: "Commission Balance",
          createdAt: "Created At",
          updatedAt: "Updated At",
          actions: "Actions"
        },
        actions: {
          editUser: "Edit User",
          deleteUser: "Delete User",
          clickToCopy: "Click to copy"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        },
        noResults: "No users found",
        search: {
          searchBy: "Search by",
          searchPlaceholder: "Search {field}...",
          filterByRole: "Filter by role",
          allRoles: "All Roles",
          banStatus: "Ban status",
          allUsers: "All users",
          bannedUsers: "Banned",
          notBannedUsers: "Not banned",
          view: "View",
          toggleColumns: "Toggle columns"
        },
        pagination: {
          showing: "Showing {start} to {end} of {total} results",
          pageInfo: "Page {current} of {total}"
        },
        dialog: {
          banTitle: "Ban User",
          banDescription: "Are you sure you want to ban this user? They will not be able to access the application.",
          banSuccess: "User banned successfully",
          unbanSuccess: "User unbanned successfully",
          updateRoleSuccess: "User role updated successfully",
          updateRoleFailed: "Failed to update user role"
        }
      },
      banDialog: {
        title: "Ban User",
        description: "Are you sure you want to ban {userName}? They will not be able to access the application."
      },
      unbanDialog: {
        title: "Unban User",
        description: "Are you sure you want to unban {userName}? They will regain access to the application."
      },
      form: {
        title: "User Information",
        description: "Enter user details below",
        labels: {
          name: "Name",
          email: "Email",
          password: "Password",
          confirmPassword: "Confirm Password",
          role: "Role",
          image: "Profile Image",
          phoneNumber: "Phone Number",
          emailVerified: "Email Verified",
          phoneVerified: "Phone Verified",
          kycVerified: "Identity Verified for Withdrawals",
          banned: "Banned",
          banReason: "Ban Reason",
          referralCode: "Referral Code",
          referredByCode: "Referred By",
          commissionBalance: "Commission Balance"
        },
        placeholders: {
          name: "Enter user's name",
          email: "Enter user's email",
          password: "Enter password (min 8 characters)",
          confirmPassword: "Confirm password",
          selectRole: "Select role",
          image: "https://example.com/avatar.jpg",
          phoneNumber: "Enter phone number",
          banReason: "Reason for banning (optional)"
        },
        validation: {
          nameRequired: "Name is required",
          emailRequired: "Email is required",
          emailInvalid: "Please enter a valid email",
          passwordRequired: "Password is required",
          passwordMinLength: "Password must be at least 8 characters",
          passwordMismatch: "Passwords do not match",
          roleRequired: "Role is required"
        }
      },
      deleteDialog: {
        title: "Delete User",
        description: "Are you absolutely sure? This action cannot be undone. This will permanently delete the user account and remove all associated data."
      },
      messages: {
        createSuccess: "User created successfully",
        updateSuccess: "User updated successfully",
        deleteSuccess: "User deleted successfully",
        deleteError: "Failed to delete user",
        fetchError: "Failed to fetch user data",
        operationFailed: "Operation failed"
      }
    },
    orders: {
      title: "Orders",
      actions: {
        createOrder: "Create Order"
      },
      messages: {
        fetchError: "Failed to load orders. Please try again."
      },
      table: {
        noResults: "No orders found.",
        search: {
          searchBy: "Search by...",
          searchPlaceholder: "Search by {field}...",
          filterByStatus: "Filter by status",
          allStatus: "All Status",
          filterByProvider: "Payment provider",
          allProviders: "All Providers",
          stripe: "Stripe",
          wechat: "WeChat",
          creem: "Creem",
          alipay: "Alipay",
          dodo: "Dodo Payments"
        },
        columns: {
          id: "Order ID",
          user: "User",
          amount: "Amount",
          plan: "Plan",
          status: "Status",
          provider: "Provider",
          providerOrderId: "Provider Order ID",
          createdAt: "Created At",
          actions: "Actions"
        },
        actions: {
          openMenu: "Open menu",
          actions: "Actions",
          viewOrder: "View order",
          refundOrder: "Refund order",
          clickToCopy: "Click to copy"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        }
      },
      status: {
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        refunded: "Refunded",
        canceled: "Canceled"
      }
    },
    blog: {
      title: "Blog Management",
      subtitle: "Create and manage blog posts",
      createPost: "Create Post",
      editPost: "Edit Post",
      actions: {
        newPost: "New Post"
      },
      messages: {
        fetchError: "Failed to load blog posts. Please try again.",
        createSuccess: "Post created successfully",
        updateSuccess: "Post updated successfully",
        deleteSuccess: "Post deleted successfully",
        deleteError: "Failed to delete post",
        operationFailed: "Operation failed",
        uploadSuccess: "Upload successful",
        uploadError: "Upload failed"
      },
      table: {
        noResults: "No posts found.",
        search: {
          searchPlaceholder: "Search by title...",
          filterByStatus: "Filter by status",
          allStatus: "All Status",
          draft: "Draft",
          published: "Published"
        },
        columns: {
          title: "Title",
          status: "Status",
          author: "Author",
          publishedAt: "Published At",
          createdAt: "Created At",
          actions: "Actions"
        },
        actions: {
          edit: "Edit",
          delete: "Delete"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        }
      },
      form: {
        title: "Post Information",
        description: "Enter post details below",
        labels: {
          title: "Title",
          slug: "Slug",
          excerpt: "Excerpt",
          coverImage: "Cover Image",
          status: "Status",
          content: "Content"
        },
        placeholders: {
          title: "Enter post title",
          slug: "URL-friendly slug (auto-generated from title)",
          excerpt: "Brief summary of the post",
          coverImage: "Drag and drop or click to upload (max 2MB)",
          content: "Write your content in Markdown..."
        }
      },
      deleteDialog: {
        title: "Delete Post",
        description: "Are you absolutely sure? This action cannot be undone. This will permanently delete the post."
      }
    },
    credits: {
      title: "Credit Transactions",
      subtitle: "View all credit transactions across all users",
      messages: {
        fetchError: "Failed to load credit transactions. Please try again."
      },
      table: {
        noResults: "No credit transactions found.",
        search: {
          searchBy: "Search by...",
          searchPlaceholder: "Search by {field}...",
          filterByType: "Filter by type",
          allTypes: "All Types",
          purchase: "Purchase",
          consumption: "Consumption",
          refund: "Refund",
          bonus: "Bonus",
          adjustment: "Adjustment"
        },
        columns: {
          id: "Transaction ID",
          user: "User",
          type: "Type",
          amount: "Amount",
          balance: "Balance",
          description: "Description",
          createdAt: "Created At",
          metadata: "Metadata"
        },
        actions: {
          clickToCopy: "Click to copy",
          viewDetails: "View details"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        },
        pagination: {
          showing: "Showing {start} to {end} of {total} results",
          pageInfo: "Page {current} of {total}"
        }
      },
      type: {
        purchase: "Purchase",
        consumption: "Consumption",
        refund: "Refund",
        bonus: "Bonus",
        adjustment: "Adjustment"
      }
    },
    subscriptions: {
      title: "Subscriptions",
      description: "Manage user subscriptions and billing",
      actions: {
        createSubscription: "Create Subscription"
      },
      messages: {
        fetchError: "Failed to load subscriptions. Please try again."
      },
      table: {
        showing: "Showing {from} to {to} of {total} results",
        noResults: "No subscriptions found.",
        rowsPerPage: "Rows per page",
        page: "Page",
        of: "of",
        view: "View",
        toggleColumns: "Toggle columns",
        goToFirstPage: "Go to first page",
        goToPreviousPage: "Go to previous page", 
        goToNextPage: "Go to next page",
        goToLastPage: "Go to last page",
        search: {
          searchLabel: "Search subscriptions",
          searchField: "Search field",
          statusLabel: "Status",
          providerLabel: "Provider",
          search: "Search",
          clear: "Clear",
          allStatuses: "All statuses",
          allProviders: "All providers",
          stripe: "Stripe",
          creem: "Creem",
          wechat: "WeChat",
          alipay: "Alipay",
          dodo: "Dodo Payments",
          userEmail: "User Email",
          subscriptionId: "Subscription ID",
          userId: "User ID",
          planId: "Plan ID",
          stripeSubscriptionId: "Stripe Subscription ID",
          creemSubscriptionId: "Creem Subscription ID",
          dodoSubscriptionId: "Dodo Subscription ID",
          placeholders: {
            userEmail: "Enter user email...",
            subscriptionId: "Enter subscription ID...",
            userId: "Enter user ID...",
            planId: "Enter plan ID...",
            stripeSubscriptionId: "Enter Stripe subscription ID...",
            creemSubscriptionId: "Enter Creem subscription ID...",
            dodoSubscriptionId: "Enter Dodo subscription ID...",
            default: "Enter search term..."
          },
          searchBy: "Search by...",
          searchPlaceholder: "Search by {field}...",
          filterByStatus: "Filter by status",
          filterByProvider: "Filter by provider",
          allStatus: "All Status",
          filterByPaymentType: "Payment type",
          allPaymentTypes: "All Types",
          active: "Active",
          canceled: "Canceled",
          expired: "Expired",
          trialing: "Trialing",
          inactive: "Inactive",
          oneTime: "One Time",
          recurring: "Recurring"
        },
        columns: {
          id: "Subscription ID",
          user: "Customer",
          plan: "Plan",
          status: "Status",
          paymentType: "Payment Type",
          provider: "Provider",
          periodStart: "Period Start",
          periodEnd: "Period End",
          cancelAtPeriodEnd: "Will Cancel",
          createdAt: "Created",
          updatedAt: "Updated",
          metadata: "Metadata",
          period: "Period",
          actions: "Actions"
        },
        actions: {
          openMenu: "Open menu",
          actions: "Actions",
          viewSubscription: "View subscription",
          cancelSubscription: "Cancel subscription",
          clickToCopy: "Click to copy"
        },
        sort: {
          ascending: "Sort ascending",
          descending: "Sort descending",
          none: "Remove sorting"
        }
      },
      status: {
        active: "Active",
        trialing: "Trialing",
        canceled: "Canceled",
        cancelled: "Canceled",
        expired: "Expired",
        inactive: "Inactive"
      },
      paymentType: {
        one_time: "One-time",
        recurring: "Recurring"
      }
    },
    pricing: {
      title: "Pricing Plans",
      description: "Manage dynamic pricing plans for your application",
      createPlan: "Create Plan",
      editPlan: "Edit Plan",
      updatePlan: "Update Plan",
      importStatic: "Import from Config",
      importing: "Importing...",
      importSuccess: "Successfully imported plans from static config",
      importConfirm: "Import all static plans from config? This will not remove existing dynamic plans.",
      deletePlan: "Delete Plan",
      confirmDelete: "Are you sure you want to deactivate this plan?",
      noPlans: "No plans found. Create one or import from static config.",
      localeCoverageWarning: "Warning: Some locales have no active plans configured. Users in those locales will see an empty pricing page.",
      tabs: {
        subscription: "Subscription Plans",
        credits: "Credit Packs",
      },
      table: {
        name: "Name",
        provider: "Provider",
        price: "Price",
        type: "Type",
        locales: "Locales",
        status: "Status",
        actions: "Actions",
        allLocales: "All",
      },
      fields: {
        provider: "Provider",
        amount: "Amount",
        originalPrice: "Original Price (strikethrough)",
        currency: "Currency",
        durationType: "Duration Type",
        durationMonths: "Duration (months)",
        credits: "Credits",
        recommended: "Recommended",
        active: "Active",
        locales: "Locales",
        stripePriceId: "Stripe Price ID",
        paypalPlanId: "PayPal Plan ID",
        creemProductId: "Creem Product ID",
        dodoProductId: "Dodo Product ID",
      },
      backToList: "Back to Plans",
      savePlan: "Save Plan",
      saving: "Saving...",
      sections: {
        planInfo: "Plan Information",
        planInfoDesc: "Define the plan name, description and features in each language",
        pricing: "Pricing",
        pricingDesc: "Set the payment provider, amount and pricing model",
        providerConfig: "Provider Configuration",
        providerConfigDesc: "Enter the product or price ID from your payment provider dashboard",
        noProviderConfig: "No additional provider ID required for this provider.",
        displaySettings: "Display Settings",
        displaySettingsDesc: "Control how and where this plan appears on the pricing page",
      },
      form: {
        providerIds: "Provider IDs",
        english: "English",
        chinese: "中文",
        name: "Name",
        description: "Description",
        durationLabel: "Duration Label",
        features: "Features (Markdown)",
        localesHint: "Comma-separated, leave empty to show to all",
        originalPricePlaceholder: "Leave empty for no discount",
        durationEnPlaceholder: "month / lifetime / one-time",
        durationZhPlaceholder: "月 / 终身 / 一次性",
        localesPlaceholder: "en, zh-CN",
      },
      mode: {
        static: "Static",
        dynamic: "Dynamic",
        switchWarning: "Switching pricing mode requires setting the PRICING_MODE environment variable and restarting the application.",
      },
    },
    commissions: {
      title: "Commission Records",
      description: "View all referral commission records",
      search: "Search by email...",
      noData: "No commission records found.",
      total: "total records",
      table: {
        referrer: "Referrer",
        buyer: "Buyer",
        orderAmount: "Order Amount",
        rate: "Rate",
        commission: "Commission",
        status: "Status",
        date: "Date",
        columns: {
          id: "ID",
          referrer: "Referrer",
          referrerEmail: "Referrer Email",
          referrerName: "Referrer Name",
          orderId: "Order ID",
          orderAmount: "Order Amount",
          rate: "Rate",
          commission: "Commission",
          status: "Status",
          date: "Date"
        },
        search: {
          searchBy: "Search by",
          searchPlaceholder: "Search {field}...",
          filterByStatus: "Filter by status"
        }
      },
      noResults: "No commission records found.",
      filter: {
        allStatus: "All Status",
        credited: "Credited",
        pending: "Pending",
        withdrawn: "Withdrawn",
        cancelled: "Cancelled",
        filterByStatus: "Filter by status"
      }
    },
    withdrawals: {
      title: "Withdrawal Requests",
      description: "Manage user withdrawal requests",
      search: "Search by email...",
      noData: "No withdrawal requests found.",
      total: "total requests",
      table: {
        user: "User",
        amount: "Amount",
        method: "Method",
        account: "Account",
        status: "Status",
        adminNote: "Admin Note",
        processedAt: "Processed At",
        processedBy: "Processed By",
        date: "Date",
        actions: "Actions",
        columns: {
          id: "ID",
          user: "User",
          userEmail: "User Email",
          userName: "User Name",
          amount: "Amount",
          method: "Method",
          paymentAccount: "Payment Account",
          status: "Status",
          adminNote: "Admin Note",
          processedAt: "Processed At",
          date: "Date",
          actions: "Actions"
        },
        search: {
          searchBy: "Search by",
          searchPlaceholder: "Search {field}...",
          filterByStatus: "Filter by status"
        }
      },
      noResults: "No withdrawal requests found.",
      actions: {
        approve: "Approve",
        reject: "Reject",
        markProcessing: "Mark Processing"
      },
      dialog: {
        title: "Process Withdrawal",
        note: "Admin Note",
        notePlaceholder: "Enter a note (optional)",
        confirm: "Confirm"
      },
      filter: {
        allStatus: "All Status",
        pending: "Pending",
        processing: "Processing",
        completed: "Completed",
        rejected: "Rejected",
        filterByStatus: "Filter by status"
      }
    }
  },
  pricing: {
    metadata: {
      title: "Vibe Chat - Pricing Plans",
      description: "Choose the perfect plan for your needs. Flexible pricing options including monthly, yearly, and lifetime subscriptions with premium features.",
      keywords: "pricing, plans, subscription, monthly, yearly, lifetime, premium, features"
    },
    title: "Pricing",
    subtitle: "Choose the plan that's right for you",
    description: "We offer both traditional time-based subscriptions (monthly/yearly/lifetime) and the AI-era popular credit system. Subscribe for unlimited access, or purchase credits and pay only for what you use.",
    cta: "Get started",
    recommendedBadge: "Recommended",
    lifetimeBadge: "One-time purchase, lifetime access",
    creditsBadge: "Credits",
    creditsUnit: "credits",
    tabs: {
      subscription: "Subscription",
      credits: "Credits",
      affiliate: "Affiliate",
      withdrawal: "Withdrawal"
    },
    features: {
      securePayment: {
        title: "Multi-Provider Security",
        description: "Support WeChat Pay, Stripe, Creem with enterprise-grade security"
      },
      flexibleSubscription: {
        title: "Flexible Payment Models",
        description: "Time-based subscription or AI-era credit system — choose your style"
      },
      globalCoverage: {
        title: "Global Payment Coverage", 
        description: "Multi-currency and regional payment methods for worldwide access"
      }
    },
    plans: {
      monthly: {
        name: "Monthly Plan",
        description: "Perfect for short-term projects",
        duration: "month",
        features: {
          "所有高级功能": "All premium features",
          "优先支持": "Priority support"
        }
      },
      yearly: {
        name: "Annual Plan",
        description: "Best value for long-term use",
        duration: "year",
        features: {
          "所有高级功能": "All premium features",
          "优先支持": "Priority support",
          "两个月免费": "2 months free"
        }
      },
      lifetime: {
        name: "Lifetime",
        description: "One-time payment, lifetime access",
        duration: "lifetime",
        features: {
          "所有高级功能": "All premium features",
          "优先支持": "Priority support",
          "终身免费更新": "Free lifetime updates"
        }
      }
    }
  },
  payment: {
    metadata: {
      success: {
        title: "Vibe Chat - Payment Successful",
        description: "Your payment has been processed successfully. Thank you for your subscription and welcome to our premium features.",
        keywords: "payment, success, subscription, confirmation, premium"
      },
      cancel: {
        title: "Vibe Chat - Payment Cancelled",
        description: "Your payment was cancelled. You can retry the payment or contact our support team for assistance.",
        keywords: "payment, cancelled, retry, support, subscription"
      }
    },
    result: {
      success: {
        title: "Payment Successful",
        description: "Your payment has been processed successfully.",
        actions: {
          viewSubscription: "View Subscription",
          backToHome: "Back to Home"
        }
      },
      cancel: {
        title: "Payment Cancelled",
        description: "Your payment has been cancelled.",
        actions: {
          tryAgain: "Try Again",
          contactSupport: "Contact Support",
          backToHome: "Back to Home"
        }
      },
      failed: "Payment failed, please try again"
    },
    steps: {
      initiate: "Initialize",
      initiateDesc: "Prepare payment",
      scan: "Scan",
      scanDesc: "Scan QR code",
      pay: "Pay",
      payDesc: "Confirm payment"
    },
    scanQrCode: "Please scan the QR code with WeChat to complete the payment",
    confirmCancel: "Your payment is not complete. Are you sure you want to cancel?",
    orderCanceled: "Your order has been canceled"
  },
  subscription: {
    metadata: {
      title: "Vibe Chat - My Subscription",
      description: "Manage your subscription plan, view billing history, and update payment methods in your subscription dashboard.",
      keywords: "subscription, billing, payment, plan, management, dashboard"
    },
    title: "My Subscription",
    overview: {
      title: "Subscription Overview",
      planType: "Plan Type",
      status: "Status",
      active: "Active",
      startDate: "Start Date",
      endDate: "End Date",
      progress: "Subscription Progress"
    },
    management: {
      title: "Subscription Management",
      description: "Manage your subscription, view billing history, and update payment methods through the customer portal.",
      manageSubscription: "Manage Subscription",
      changePlan: "Change Plan",
      redirecting: "Redirecting..."
    },
    noSubscription: {
      title: "No Active Subscription Found",
      description: "You currently don't have an active subscription plan.",
      viewPlans: "View Plans"
    }
  },
  dashboard: {
    metadata: {
      title: "Vibe Chat - Dashboard",
      description: "Manage your account, subscriptions, and profile settings in your personalized dashboard.",
      keywords: "dashboard, account, profile, subscription, settings, management"
    },
    title: "Dashboard",
    description: "Manage your account and subscriptions",
    profile: {
      title: "Profile Information",
      noNameSet: "No name set",
      role: "Role:",
      emailVerified: "Email verified",
      editProfile: "Edit Profile",
      updateProfile: "Update Profile",
      cancel: "Cancel",
      form: {
        labels: {
          name: "Full Name",
          email: "Email Address",
          image: "Profile Image URL"
        },
        placeholders: {
          name: "Enter your full name",
          email: "Email address",
          image: "https://example.com/your-image.jpg"
        },
        emailReadonly: "Email address cannot be modified",
        imageDescription: "Optional: Enter a URL for your profile picture"
      },
      updateSuccess: "Profile updated successfully",
      updateError: "Failed to update profile. Please try again."
    },
    subscription: {
      title: "Subscription Status",
      status: {
        lifetime: "Lifetime",
        active: "Active",
        canceled: "Canceled",
        cancelAtPeriodEnd: "Canceling at Period End",
        pastDue: "Past Due",
        unknown: "Unknown",
        noSubscription: "No Subscription"
      },
      paymentType: {
        recurring: "Recurring",
        oneTime: "One-time"
      },
      lifetimeAccess: "You have lifetime access",
      expires: "Expires:",
      cancelingNote: "Your subscription will not renew and will end on:",
      noActiveSubscription: "You currently have no active subscription",
      manageSubscription: "Manage Subscription",
      viewPlans: "View Plans"
    },
    credits: {
      title: "Credit Balance",
      available: "Available Credits",
      totalPurchased: "Total Purchased",
      totalConsumed: "Total Used",
      recentTransactions: "Recent Transactions",
      buyMore: "Buy More Credits",
      types: {
        purchase: "Purchase",
        bonus: "Bonus",
        consumption: "Used",
        refund: "Refund",
        adjustment: "Adjustment"
      },
      descriptions: {
        ai_chat: "AI Chat",
        ai_image_generation: "AI Image Generation",
        ai_video_generation: "AI Video Generation",
        image_generation: "Image Generation",
        document_processing: "Document Processing",
        purchase: "Credit Purchase",
        bonus: "Bonus Credits",
        refund: "Credit Refund",
        adjustment: "Admin Adjustment",
        referral_signup_bonus: "Referral Signup Bonus",
        referral_referrer_bonus: "Referral Reward"
      },
      table: {
        type: "Type",
        description: "Description",
        amount: "Amount",
        time: "Time"
      }
    },
    affiliate: {
      title: "Affiliate Program",
      description: "Earn commissions by referring new users",
      referralLink: "Your Referral Link",
      copyLink: "Copy Link",
      copied: "Copied!",
      bonusFailed: "Referral applied, but the signup bonus could not be granted.",
      claimFailed: "Failed to claim referral code.",
      commissionBalance: "Commission Balance",
      commissionRate: "Commission Rate",
      totalCommission: "Total Earned",
      totalReferrals: "Total Referrals",
      paidReferrals: "Paid Referrals",
      signupBonus: "Signup Bonus",
      referrerBonus: "You get {amount} credits per referral signup",
      refereeBonus: "Referred users get {amount} credits",
      noReferrals: "No referrals yet",
      noCommissions: "No commissions yet",
      referralsTab: "Referrals",
      commissionsTab: "Commissions",
      table: {
        user: "User",
        email: "Email",
        joinDate: "Joined",
        buyer: "Buyer",
        orderAmount: "Order Amount",
        rate: "Rate",
        commission: "Commission",
        status: "Status",
        date: "Date"
      },
      status: {
        pending: "Pending",
        credited: "Credited",
        withdrawn: "Withdrawn",
        cancelled: "Cancelled"
      }
    },
    withdrawal: {
      title: "Withdrawal",
      description: "Withdraw your commission balance",
      balance: "Available Balance",
      amount: "Amount",
      amountPlaceholder: "Enter withdrawal amount",
      paymentMethod: "Payment Method",
      selectMethod: "Select payment method",
      paymentAccount: "Payment Account",
      accountPlaceholder: "Enter your payment account",
      submit: "Request Withdrawal",
      minAmount: "Minimum withdrawal amount: {amount}",
      history: "Withdrawal History",
      noHistory: "No withdrawal history",
      methods: {
        alipay: "Alipay",
        paypal: "PayPal",
        bank_transfer: "Bank Transfer"
      },
      status: {
        pending: "Pending",
        processing: "Processing",
        completed: "Completed",
        rejected: "Rejected"
      },
      table: {
        amount: "Amount",
        method: "Method",
        account: "Account",
        status: "Status",
        date: "Date",
        note: "Note"
      }
    },
    account: {
      title: "Account Details",
      memberSince: "Member since",
      phoneNumber: "Phone Number"
    },
    orders: {
      title: "Order History",
      status: {
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        refunded: "Refunded",
        canceled: "Canceled"
      },
      provider: {
        stripe: "Stripe",
        wechat: "WeChat Pay",
        creem: "Creem",
        alipay: "Alipay",
        dodo: "Dodo Payments"
      },
      noOrders: "No orders found",
      noOrdersDescription: "You haven't placed any orders yet",
      viewAllOrders: "View All Orders",
      orderDetails: {
        orderId: "Order ID",
        amount: "Amount",
        plan: "Plan",
        status: "Status",
        provider: "Payment Method",
        createdAt: "Created"
      },
      recent: {
        title: "Recent Orders",
        showingRecent: "Showing {count} most recent orders"
      },
      page: {
        title: "All Orders",
        description: "View and manage all your orders",
        backToDashboard: "Back to Dashboard",
        totalOrders: "Total {count} orders"
      }
    },
    linkedAccounts: {
      title: "Linked Accounts",
      connected: "Connected",
      connectedAt: "Connected:",
      noLinkedAccounts: "No linked accounts",
      providers: {
        credential: "Email & Password",
        google: "Google",
        github: "GitHub",
        facebook: "Facebook",
        apple: "Apple",
        discord: "Discord",
        wechat: "WeChat",
        "phone-number": "Phone Number"
      }
    },
    tabs: {
      profile: {
        title: "Profile",
        description: "Manage your personal information and avatar"
      },
      account: {
        title: "Account Management",
        description: "Password changes, linked accounts and security"
      },
      security: {
        title: "Security",
        description: "Password and security settings"
      },
      subscription: {
        description: "Manage your subscription plan and features"
      },
      credits: {
        title: "Credits",
        description: "View your credit balance and transactions"
      },
      orders: {
        description: "View your order history and transactions"
      },
      content: {
        profile: {
          title: "Profile",
          subtitle: "This is how others will see you on the site.",
          username: {
            label: "Username",
            value: "shadcn",
            description: "This is your public display name. It can be your real name or a pseudonym. You can only change this once every 30 days."
          },
          email: {
            label: "Email",
            placeholder: "Select a verified email to display",
            description: "You can manage verified email addresses in your email settings."
          }
        },
        account: {
          title: "Account Settings",
          subtitle: "Manage your account settings and preferences.",
          placeholder: "Account settings content..."
        },
        security: {
          title: "Security Settings",
          subtitle: "Manage your password and security settings.",
          placeholder: "Security settings content..."
        }
      }
    },
    quickActions: {
      title: "Quick Actions",
      editProfile: "Edit Profile",
      accountSettings: "Account Settings",
      subscriptionDetails: "Subscription Details",
      getSupport: "Get Support",
      viewDocumentation: "View Documentation"
    },
    accountManagement: {
      title: "Account Management",
      changePassword: {
        title: "Change Password",
        description: "Update your account password",
        oauthDescription: "Password management is not available for social login accounts",
        button: "Change Password",
        dialogDescription: "Please enter your current password and choose a new one",
        form: {
          currentPassword: "Current Password",
          currentPasswordPlaceholder: "Enter your current password",
          newPassword: "New Password",
          newPasswordPlaceholder: "Enter new password (minimum 8 characters)",
          confirmPassword: "Confirm New Password",
          confirmPasswordPlaceholder: "Confirm your new password",
          cancel: "Cancel",
          submit: "Update Password"
        },
        success: "Password updated successfully",
        errors: {
          required: "Please fill in all required fields",
          mismatch: "New passwords do not match",
          minLength: "Password must be at least 8 characters long",
          failed: "Failed to update password. Please try again."
        }
      },
      deleteAccount: {
        title: "Delete Account",
        description: "Permanently delete your account and all associated data",
        button: "Delete Account",
        confirmTitle: "Delete Account",
        confirmDescription: "Are you absolutely sure you want to delete your account?",
        warning: "⚠️ This action cannot be undone",
        consequences: {
          data: "All your personal data will be permanently deleted",
          subscriptions: "Active subscriptions will be cancelled",
          access: "You will lose access to all premium features"
        },
        form: {
          cancel: "Cancel",
          confirm: "Yes, Delete My Account"
        },
        success: "Account deleted successfully",
        errors: {
          failed: "Failed to delete account. Please try again."
        }
      }
    },
    roles: {
      admin: "Administrator",
      user: "User"
    }
  },
  home: {
    metadata: {
      title: "Vibe Chat - Every Conversation Has a Place",
      description: "An atmosphere-first chat project for conversations that deserve a space of their own.",
      keywords: "chat, atmosphere spaces, creative community, messaging"
    },
    intro: {
      eyebrow: "Atmosphere-first chat",
      index: "VIBE / 001",
      title: "A place for every conversation.",
      description: "Vibe Chat is exploring a new kind of chat: choose the people, choose the atmosphere, and let the room become part of the conversation.",
      status: "Accounts, product state, contacts, and Matrix messaging now run on real service paths. Built-in atmospheres are clearly separated from the upcoming third-party runtime.",
      openChat: "Open Vibe Chat"
    },
    footer: {
      tagline: "Atmosphere-first chat.",
      copyright: "© {year} Vibe Chat. All rights reserved."
    }
  },
  ai: {
    metadata: {
      title: "Vibe Chat - AI Assistant",
      description: "Interact with powerful AI models including GPT-4, Qwen, and DeepSeek. Get AI assistance for coding, writing, and problem-solving.",
      keywords: "AI, assistant, chatbot, GPT-4, artificial intelligence, machine learning, conversation"
    },
    chat: {
      title: "AI Assistant",
      description: "A simple implementation of large model conversation with extensible design, using the latest technologies ai-sdk / ai-elements / streamdown to achieve very smooth chat effects, can be extended to more complex functions as needed",
      placeholder: "What can I help you with?",
      sending: "Sending...",
      thinking: "AI is thinking...",
      noMessages: "Start a conversation with the AI assistant",
      welcomeMessage: "Hello! I'm your AI assistant. How can I help you today?",
      toolCall: "Tool Call",
      providers: {
        title: "AI Provider",
        openai: "OpenAI",
        qwen: "Qwen",
        deepseek: "DeepSeek"
      },
      models: {
        "gpt-5": "GPT-5",
        "gpt-5-codex": "GPT-5 Codex",
        "gpt-5-pro": "GPT-5 Pro",
        "qwen-max": "Qwen Max",
        "qwen-plus": "Qwen Plus", 
        "qwen-turbo": "Qwen Turbo",
        "deepseek-chat": "DeepSeek Chat",
        "deepseek-coder": "DeepSeek Coder"
      },
      actions: {
        send: "Send",
        copy: "Copy",
        copied: "Copied!",
        retry: "Retry",
        dismiss: "Dismiss",
        newChat: "New Chat",
        clearHistory: "Clear History"
      },
      errors: {
        failedToSend: "Failed to send message. Please try again.",
        networkError: "Network error. Please check your connection.",
        invalidResponse: "Invalid response from AI. Please try again.",
        rateLimited: "Too many requests. Please wait a moment.",
        subscriptionRequired: "AI features require an active subscription",
        subscriptionRequiredDescription: "Upgrade to a premium plan to access AI chat features",
        insufficientCredits: "Insufficient Credits",
        insufficientCreditsDescription: "You need credits or a subscription to use AI chat. Purchase credits to continue."
      },
      history: {
        title: "Chat History",
        empty: "No chat history",
        today: "Today",
        yesterday: "Yesterday",
        thisWeek: "This Week",
        older: "Older"
      }
    },
    image: {
      metadata: {
        title: "Vibe Chat - AI Image Generation",
        description: "Generate stunning images using AI. Powered by Qwen-Image, fal.ai Flux, OpenAI DALL-E, and Google Gemini.",
        keywords: "AI, image generation, DALL-E, Flux, Qwen, Gemini, text to image, art, creative"
      },
      title: "AI Image Generation",
      description: "Generate stunning images from text prompts using multiple AI providers",
      defaultPrompt: "A yellow Labrador wearing black and gold round sunglasses drinking tea with two yellow and white cats in a venue in Chengdu",
      prompt: "Prompt",
      promptPlaceholder: "Describe the image you want to generate...",
      negativePrompt: "Negative Prompt",
      negativePromptPlaceholder: "Describe what you don't want in the image...",
      negativePromptHint: "Describe elements to avoid in the generated image",
      generate: "Generate",
      generating: "Generating...",
      generatedSuccessfully: "Image generated successfully!",
      download: "Download",
      result: "Result",
      idle: "Idle",
      preview: "Preview",
      json: "JSON",
      whatNext: "What would you like to do next?",
      costInfo: "Your request will cost",
      perMegapixel: "per megapixel",
      credits: "credits",
      providers: {
        title: "Provider",
        qwen: "Aliyun BaiLian",
        fal: "fal.ai",
        openai: "OpenAI",
        gemini: "Google Gemini"
      },
      models: {
        "qwen-image-plus": "Qwen Image Plus",
        "qwen-image-max": "Qwen Image Max",
        "fal-ai/qwen-image-2512/lora": "Qwen Image 2512 Lora",
        "fal-ai/nano-banana-pro": "Nano Banana Pro",
        "fal-ai/flux/dev": "Flux Dev",
        "fal-ai/recraft/v3/text-to-image": "Recraft V3 Text to Image",
        "fal-ai/flux-pro/kontext": "Flux Pro Kontext",
        "fal-ai/bytedance/seedream/v3/text-to-image": "Bytedance Seedream V3 Text to Image",
        "dall-e-3": "DALL-E 3",
        "dall-e-2": "DALL-E 2",
        "gemini-3.1-flash-image-preview": "Nano Banana 2",
        "gemini-3-pro-image-preview": "Nano Banana Pro",
        "gemini-2.5-flash-image": "Nano Banana"
      },
      settings: {
        title: "Additional Settings",
        showMore: "More",
        showLess: "Less",
        imageSize: "Image Size",
        imageSizeHint: "Select the aspect ratio and resolution",
        numInferenceSteps: "Num Inference Steps",
        numInferenceStepsHint: "More steps = higher quality but slower",
        guidanceScale: "Guidance Scale",
        guidanceScaleHint: "How closely to follow the prompt",
        seed: "Seed",
        seedHint: "Use the same seed to reproduce results",
        random: "random",
        randomize: "Randomize",
        promptExtend: "Prompt Extend",
        promptExtendHint: "AI will enhance and expand your prompt",
        watermark: "Watermark",
        watermarkHint: "Add Qwen-Image watermark to the generated image",
        syncMode: "Sync Mode",
        syncModeHint: "Return base64 data instead of URL"
      },
      errors: {
        generationFailed: "Image generation failed",
        invalidPrompt: "Please enter a valid prompt",
        insufficientCredits: "Insufficient Credits",
        insufficientCreditsDescription: "You need credits to generate images. Purchase credits to continue.",
        networkError: "Network error. Please check your connection.",
        unknownError: "An unknown error occurred"
      }
    },
    video: {
      metadata: {
        title: "Vibe Chat - AI Video Generation",
        description: "Generate stunning videos using AI. Powered by fal.ai, Volcengine Seedance, and Aliyun Wanxiang.",
        keywords: "AI, video generation, text to video, Seedance, Wanxiang, Luma, creative"
      },
      title: "AI Video Generation",
      description: "Generate stunning videos from text prompts using multiple AI providers",
      defaultPrompt: "A cat jumps directly from someone's lap onto the sofa",
      prompt: "Prompt",
      model: "Model",
      promptPlaceholder: "Describe the video you want to generate...",
      generate: "Generate Video",
      generating: "Generating video...",
      generatedSuccessfully: "Video generated successfully!",
      download: "Download Video",
      result: "Result",
      idle: "Enter a prompt to generate a video",
      whatNext: "What would you like to do next?",
      credits: "Credits",
      providers: {
        title: "Provider",
        fal: "fal.ai",
        volcengine: "Volcengine",
        aliyun: "Aliyun Wanxiang"
      },
      models: {
        "kling-video/v2.5-turbo/pro/text-to-video": "Kling 2.5 Turbo Pro (Text to Video)",
        "kling-video/v2.5-turbo/pro/image-to-video": "Kling 2.5 Turbo Pro (Image to Video)",
        "doubao-seedance-1-5-pro-251215": "Doubao Seedance 1.5 Pro",
        "doubao-seedance-1-0-pro-250528": "Doubao Seedance 1.0 Pro",
        "wan2.6-t2v": "Wanxiang 2.6 T2V",
        "wan2.5-t2v-turbo": "Wanxiang 2.5 T2V Turbo",
        "wan2.6-i2v-flash": "Wanxiang 2.6 I2V Flash"
      },
      inputMode: {
        label: "Generation Mode",
        text: "Text to Video",
        firstFrame: "First Frame",
        firstLastFrame: "First + Last Frame",
        firstLastFrameUnsupported: "Current provider supports first frame only"
      },
      frameInput: {
        title: "Frame Images",
        hint: "Use URL directly, or upload to Cloudflare R2.",
        firstFrameUrl: "First Frame URL",
        lastFrameUrl: "Last Frame URL",
        upload: "Upload",
        uploadedToR2: "Frame uploaded to R2",
        preview: "Image Preview",
        previewAlt: "First frame preview"
      },
      settings: {
        title: "Additional Settings",
        videoSize: "Video Size / Aspect Ratio",
        videoSizePlaceholder: "Select size",
        videoSizeHint: "Select the resolution or aspect ratio",
        duration: "Duration (seconds)",
        durationHint: "Length of the generated video",
        seed: "Seed",
        seedHint: "Use the same seed to reproduce results",
        random: "random",
        loop: "Loop",
        loopHint: "Whether the video should loop seamlessly",
        motionStrength: "Motion Strength",
        motionStrengthHint: "Controls how much motion appears in the video",
        promptExtend: "Prompt Extend",
        promptExtendHint: "AI will enhance and expand your prompt",
        watermark: "Watermark",
        watermarkHint: "Add watermark to the generated video"
      },
      errors: {
        generationFailed: "Video generation failed",
        invalidPrompt: "Please enter a valid prompt",
        firstFrameRequired: "Please provide a first frame URL",
        lastFrameRequired: "Please provide a last frame URL",
        unsupportedImageType: "Only JPEG/JPG/PNG/WEBP/BMP images are supported",
        imageTooLarge: "Image size must be less than or equal to 10MB",
        uploadFailed: "Upload failed",
        unsupportedModeForProvider: "Current provider does not support this generation mode",
        insufficientCredits: "Insufficient Credits",
        insufficientCreditsDescription: "You need credits to generate videos. Purchase credits to continue.",
        networkError: "Network error. Please check your connection.",
        unknownError: "An unknown error occurred",
        timeout: "Video generation timed out. Please try again."
      },
      resultPanel: {
        generatingHint: "Video generation may take 1-5 minutes...",
        videoTagUnsupported: "Your browser does not support the video tag."
      }
    }
  },
  premiumFeatures: {
    metadata: {
      title: "Vibe Chat - Premium Features",
      description: "Explore all the premium features available with your subscription. Access advanced tools, AI assistance, and enhanced functionality.",
      keywords: "premium, features, advanced, tools, subscription, benefits, enhanced"
    },
    title: "Premium Features",
    description: "Thank you for your subscription! Here are all the premium features you can now access.",
    loading: "Loading...",
    subscription: {
      title: "Your Subscription",
      description: "Current subscription status and details",
      status: "Subscription Status",
      type: "Subscription Type",
      expiresAt: "Expires At",
      active: "Active",
      inactive: "Inactive",
      lifetime: "Lifetime Member",
      recurring: "Recurring Subscription"
    },
    badges: {
      lifetime: "Lifetime Member"
    },
    demoNotice: {
      title: "🎯 SaaS Template Demo Page",
      description: "This is a demo page for testing route protection. Only paying users can access this page, demonstrating how to implement subscription-level access control in your SaaS application."
    },
    features: {
      userManagement: {
        title: "Advanced User Management",
        description: "Complete user profile management and custom settings"
      },
      aiAssistant: {
        title: "AI Smart Assistant",
        description: "Advanced artificial intelligence features to boost productivity"
      },
      documentProcessing: {
        title: "Unlimited Document Processing",
        description: "Process any number and size of document files"
      },
      dataAnalytics: {
        title: "Detailed Data Analytics",
        description: "In-depth data analysis and visualization reports"
      }
    },
    actions: {
      accessFeature: "Access Feature"
    }
  },
  validators: {
    user: {
      name: {
        minLength: "Name must be at least {min} characters",
        maxLength: "Name must be less than {max} characters"
      },
      email: {
        invalid: "Please enter a valid email address"
      },
      image: {
        invalidUrl: "Please enter a valid URL"
      },
      password: {
        minLength: "Password must be at least {min} characters",
        maxLength: "Password must be less than {max} characters",
        mismatch: "Passwords don't match"
      },
      countryCode: {
        required: "Please select country/region"
      },
      phoneNumber: {
        required: "Please enter phone number",
        invalid: "Invalid phone number format"
      },
      verificationCode: {
        invalidLength: "Verification code must be {length} characters"
      },
      id: {
        required: "User ID is required"
      },
      currentPassword: {
        required: "Current password is required"
      },
      confirmPassword: {
        required: "Please confirm your password"
      },
      deleteAccount: {
        confirmRequired: "You must confirm account deletion"
      }
    },
    blog: {
      title: {
        required: "Title is required",
        maxLength: "Title must be less than {max} characters",
      },
      slug: {
        maxLength: "Slug must be less than {max} characters",
        invalid: "Slug can only contain lowercase letters, numbers, and hyphens",
      },
      excerpt: {
        maxLength: "Excerpt must be less than {max} characters",
      },
      coverImage: {
        invalidUrl: "Please enter a valid URL for the cover image",
      },
      status: {
        invalid: "Status must be either draft or published",
      },
    },
    withdrawal: {
      amount: {
        required: "Please enter the withdrawal amount",
        positive: "Amount must be greater than 0",
      },
      paymentMethod: {
        required: "Please select a payment method",
      },
      paymentAccount: {
        required: "Please enter your payment account",
        maxLength: "Payment account must be less than {max} characters",
      },
    },
  },
  countries: {
    china: "China",
    usa: "United States",
    uk: "United Kingdom",
    japan: "Japan",
    korea: "South Korea",
    singapore: "Singapore",
    hongkong: "Hong Kong",
    macau: "Macau",
    australia: "Australia",
    france: "France",
    germany: "Germany",
    india: "India",
    malaysia: "Malaysia",
    thailand: "Thailand"
  },
  header: {
    navigation: {
      ai: "AI Demo",
      premiumFeatures: "Premium Features",
      pricing: "Pricing",
      upload: "Upload",
      demos: "Demos",
      demosDescription: "Explore example features",
      blog: "Blog",
      affiliate: "Affiliate"
    },
    demos: {
      ai: {
        title: "AI Chat",
        description: "LLM chat with extensible design, multi-provider support. Login required."
      },
      aiImage: {
        title: "AI Image Generation",
        description: "AI image generation with extensible design, multi-provider support. Login required."
      },
      aiVideo: {
        title: "AI Video Generation",
        description: "AI video generation with extensible design, multi-provider support. Login required."
      },
      premium: {
        title: "Premium Features",
        description: "Route protection demo. Only paid users can access this page."
      },
      upload: {
        title: "File Upload",
        description: "File upload with extensible design, multi-provider support. Login required."
      }
    },
    auth: {
      signIn: "Sign In",
      getStarted: "Get Started",
      signOut: "Sign Out"
    },
    userMenu: {
      dashboard: "Dashboard",
      profile: "Profile",
      editProfile: "Edit profile",
      profileSave: "Save profile",
      profileSaving: "Saving…",
      profileCancel: "Cancel",
      profileSaveFailed: "Your profile could not be saved.",
      settings: "Settings",
      personalSettings: "Personal Settings",
      adminPanel: "Admin Panel"
    },
    language: {
      switchLanguage: "Switch Language",
      english: "English",
      chinese: "中文"
    },
    mobile: {
      themeSettings: "Theme Settings",
      languageSelection: "Language Selection"
    }
  },
  chatApp: {
    nav: {
      messages: "Messages",
      contacts: "Contacts",
      discover: "Discover",
      services: "Services",
      me: "Me",
      primaryLabel: "Primary navigation"
    },
    common: {
      viewAll: "View all"
    },
    matrix: {
      title: "Synapse connected",
      description: "Rooms and messages are synced from Matrix. This browser only keeps SDK cache and interface preferences."
    },
    service: {
      connecting: "Connecting your account",
      connectingDescription: "Loading your product profile, preferences, contacts, and encrypted Matrix device session.",
      unavailable: "Messaging is not configured",
      unavailableDescription: "Your account is ready, but this environment has no active Synapse connection. No demo data has been substituted.",
      failed: "Messaging could not start",
      failedDescription: "We kept your account data untouched. Check the service and try the connection again."
    },
    onboarding: {
      kicker: "A small beginning",
      storyTitle: "Choose the people. Then choose how the room should feel.",
      storyDescription: "Vibe Chat keeps familiar messaging controls around every atmosphere, so the conversation can change without giving up trust or clarity.",
      pickPeople: "Start with people",
      pickPeopleDescription: "Contacts and invitations stay under your control.",
      setAtmosphere: "Set an atmosphere",
      setAtmosphereDescription: "Every room gets a deliberate shared canvas.",
      keepControl: "Keep the host controls",
      keepControlDescription: "Identity, privacy and recovery remain consistent.",
      step: "Profile setup · 1 of 1",
      title: "Make this place yours.",
      description: "Your display name is what people see. Your unique username helps them find you.",
      avatar: "Profile image",
      avatarHelp: "JPG, PNG, WebP or GIF · up to 5 MB · optional",
      avatarInvalid: "Choose a supported image smaller than 5 MB.",
      avatarUploadFailed: "The image could not be uploaded. Skip it for now or try again.",
      skipAvatar: "Skip this image",
      displayName: "Display name",
      displayNameHelp: "You can change this later from your profile.",
      username: "Unique username",
      usernameHelp: "3–30 lowercase letters, numbers, or underscores.",
      usernameTaken: "That username is already taken.",
      continue: "Enter Vibe Chat",
      saving: "Saving your profile…",
      loadFailed: "Your profile could not be loaded. Try refreshing the page.",
      saveFailed: "Your profile could not be saved. Please try again.",
      privacyNote: "We will ask about notifications later, in context—not during setup."
    },
    presence: {
      online: "Online",
      away: "Away",
      offline: "Offline"
    },
    messages: {
      kicker: "Your conversations",
      title: "Messages",
      newChat: "New chat",
      searchPlaceholder: "Search rooms or people",
      unread: "Unread",
      muted: "Muted",
      roomActions: "Conversation actions",
      pin: "Pin conversation",
      unpin: "Unpin conversation",
      mute: "Mute conversation",
      unmute: "Unmute conversation",
      markRead: "Mark as read",
      noResults: "No conversations here",
      noResultsDescription: "Try another search or turn off the unread filter.",
      matrixSynced: "Matrix timeline synced",
      today: "Today in Vibe Chat",
      welcomeBack: "Good to have you back.",
      unreadSummary: "You have {count} unread moments waiting across your spaces.",
      caughtUp: "You are caught up. Start a small conversation or wander into a new atmosphere.",
      featuredAtmosphere: "Featured atmosphere",
      startWithSpace: "Start a chat in this space",
      recentPeople: "Recent people",
      recentActivity: "Recent activity",
      pickUp: "Pick up where the feeling left off"
    },
    room: {
      notFound: "This room could not be found",
      notFoundDescription: "It may no longer be available to this account, or Matrix is still synchronizing it.",
      backToMessages: "Back to messages",
      connected: "Timeline connected",
      roomMenu: "Room menu",
      recoveryView: "Open recovery view",
      hideControls: "Hide room controls",
      showControls: "Show room controls",
      matrixSpace: "Matrix-backed atmosphere",
      memberCount: "{count} members in this atmosphere",
      sending: "Sending…",
      sent: "Sent",
      failed: "Failed to send",
      retryFailed: "Failed · Retry",
      reply: "Reply",
      react: "React with",
      replyingTo: "Replying to {name}",
      edited: "Edited",
      editingMessage: "Editing message",
      editMessage: "Edit message",
      deleteMessage: "Delete message",
      deleteMessageConfirm: "Everyone in the room will see that this message was deleted. Continue?",
      deletedMessage: "This message was deleted",
      typing: "{names} is typing…",
      attach: "Attach a file",
      attachmentFallback: "Attachment: {name}",
      emoji: "Choose an emoji",
      messagePlaceholder: "Write into this atmosphere…",
      send: "Send message",
      composerHint: "Enter to send · Shift + Enter for a new line",
      sendFailed: "Message could not be sent. Try again."
    },
    newChat: {
      peopleTitle: "Who is this moment for?",
      peopleDescription: "Choose up to 50 contacts before deciding how the conversation should feel.",
      spaceTitle: "Set the atmosphere",
      spaceDescription: "Every room needs one atmosphere. It owns the conversation canvas.",
      reviewTitle: "One last look",
      reviewDescription: "Review the people, space, and requested capabilities before creating the room.",
      progressLabel: "New chat progress",
      searchPeople: "Search your contacts",
      selectedPeople: "Selected people",
      atmosphere: "Atmosphere",
      participants: "Participants",
      permissions: "Capabilities",
      permissionSummary: "{count} declared capabilities · no external network",
      matrixNotice: "This creates a private Matrix room with an idempotent product index and an immutable atmosphere snapshot.",
      create: "Create room",
      creating: "Creating…",
      createFailed: "The room could not be created. Check the selected contacts and try again."
    },
    contacts: {
      kicker: "People you know",
      title: "Contacts",
      description: "Start with trust, then choose the atmosphere for the conversation.",
      searchPlaceholder: "Search name or username",
      requests: "Friend requests",
      requestedToConnect: "wants to connect with you",
      accept: "Accept request",
      reject: "Reject request",
      searchResults: "People",
      searching: "Searching…",
      noUsersFound: "No matching user found",
      addContact: "Send friend request",
      requestSent: "Friend request sent",
      allContacts: "All contacts",
      contactProfile: "Contact profile",
      startChat: "Start a chat",
      addToGroup: "Add to a group",
      sharedRooms: "Shared atmosphere rooms",
      acceptInvite: "Accept room invitation",
      declineInvite: "Decline room invitation",
      invited: "Room invitation",
      block: "Block this user",
      blockContact: "Block contact",
      remark: "Private remark",
      editRemark: "Edit private remark",
      saveRemark: "Save remark",
      savingRemark: "Saving…",
      cancelRemark: "Cancel",
      clearRemark: "Clear",
      remarkFailed: "The remark could not be saved.",
      blockConfirm: "Blocking removes the contact relationship and prevents new friend requests and room invitations. Continue?"
    },
    discover: {
      kicker: "Atmosphere directory",
      title: "Find a different way to talk.",
      description: "Spaces turn a room into a late-night radio, a shared table, a small ritual, or something entirely new.",
      searchPlaceholder: "Search spaces or creators",
      categoryLabel: "Atmosphere categories",
      categories: {
        all: "All spaces",
        daily: "Everyday",
        focus: "Focus",
        play: "Play",
        ritual: "Ritual"
      },
      official: "Official",
      community: "Community",
      save: "Save",
      saved: "Saved",
      unsave: "Remove from saved",
      noResults: "No atmosphere matched",
      noResultsDescription: "Try a broader search or another category.",
      backToDiscover: "Back to discover",
      sandboxPreview: "Sandbox preview",
      by: "By {author}",
      permissions: "Capabilities",
      permissionCount: "{count} declared",
      externalNetwork: "External network",
      noExternalNetwork: "No external domains",
      useThisSpace: "Use this atmosphere"
    },
    me: {
      kicker: "Your corner",
      title: "Me",
      description: "Manage your identity, product preferences, privacy, sessions, and local Matrix cache.",
      profile: "Profile",
      rooms: "Rooms",
      contacts: "Contacts",
      savedSpaces: "Saved spaces",
      preferences: "Preferences",
      notifications: "Notifications",
      notificationsDescription: "Room activity and contextual prompts",
      appearance: "Appearance",
      appearanceDescription: "Light, dark, or system theme",
      language: "Language",
      languageDescription: "Interface and space locale",
      securityAndData: "Security & data",
      devices: "Devices and sessions",
      devicesDescription: "Review connected browser sessions",
      privacy: "Privacy and blocked users",
      privacyDescription: "Friend requests, permissions, and block list",
      manage: "Manage",
      unblock: "Unblock",
      noBlockedUsers: "Your block list is empty",
      activeSessions: "{count} active sessions",
      loadingSessions: "Loading active sessions…",
      sessionsFailed: "Sessions are temporarily unavailable.",
      unknownBrowser: "Unknown browser",
      currentSession: "Current device",
      revokeSession: "Revoke",
      revokeOthers: "Revoke other devices",
      signOut: "Sign out",
      signingOut: "Signing out…",
      signOutDescription: "End this product session and revoke its Matrix device",
      localData: "Local Matrix cache",
      matrixDataDescription: "Cached timeline data for this Matrix device; product preferences stay on your account",
      clearCache: "Clear cache",
      about: "About",
      hostSafety: "Host safety boundary",
      hostSafetyDescription: "System controls stay outside atmosphere canvases",
      help: "Help and documentation",
      helpDescription: "Learn how rooms and atmosphere spaces work",
      accountCenter: "Account center",
      accountCenterDescription: "Subscription, credits, orders, referrals, and withdrawals"
    },
    account: {
      kicker: "Account ledger",
      title: "Account center",
      description: "Everything that changes your access or balance, backed by the shared service ledger.",
      tabs: {
        overview: "Overview",
        credits: "Credits",
        orders: "Orders",
        affiliate: "Referrals",
        security: "Security"
      },
      loading: "Loading account records…",
      loadFailed: "Some account records could not be loaded.",
      retry: "Retry",
      subscription: "Subscription",
      activePlan: "Active plan",
      noSubscription: "No active subscription",
      lifetime: "Lifetime access",
      manageSubscription: "Manage subscription",
      credits: "Credit balance",
      availableCredits: "Available credits",
      purchased: "Purchased",
      consumed: "Used",
      recentActivity: "Recent ledger activity",
      noTransactions: "No credit transactions yet.",
      orders: "Orders",
      noOrders: "No orders yet.",
      order: "Order",
      plan: "Plan",
      provider: "Provider",
      status: "Status",
      amount: "Amount",
      date: "Date",
      affiliateUnavailable: "Referral data is unavailable.",
      affiliateDisabled: "The referral program is currently disabled.",
      referralLink: "Your referral link",
      copy: "Copy",
      copied: "Copied",
      commissionBalance: "Commission balance",
      registeredReferrals: "Registered referrals",
      paidReferrals: "Paid referrals",
      commissions: "Commissions",
      referrals: "Referred accounts",
      noCommissions: "No commission entries yet.",
      noReferrals: "No referred accounts yet.",
      withdrawal: "Withdraw commission",
      withdrawalAmount: "Amount",
      withdrawalMethod: "Payout method",
      withdrawalAccount: "Payout account",
      submitWithdrawal: "Request withdrawal",
      submittingWithdrawal: "Submitting…",
      withdrawalSuccess: "Withdrawal request submitted.",
      withdrawalFailed: "Withdrawal request failed.",
      withdrawalHistory: "Withdrawal history",
      noWithdrawals: "No withdrawal requests yet.",
      minWithdrawal: "Minimum withdrawal: {amount} {currency}",
      paymentMethods: {
        alipay: "Alipay",
        paypal: "PayPal",
        bankTransfer: "Bank transfer"
      },
      security: {
        title: "Account security",
        description: "Manage passwords, linked sign-in methods, and account deletion.",
        linkedAccounts: "Linked sign-in methods",
        linkedAt: "Linked {date}",
        noLinkedAccounts: "No linked sign-in methods were found.",
        passwordTitle: "Change password",
        currentPassword: "Current password",
        newPassword: "New password",
        confirmPassword: "Confirm new password",
        changePassword: "Update password",
        changingPassword: "Updating…",
        passwordChanged: "Password updated. Other browser sessions were revoked.",
        passwordMismatch: "The new passwords do not match.",
        passwordFailed: "Password could not be updated.",
        socialOnly: "This account uses an external sign-in provider and has no local password.",
        dangerTitle: "Delete account",
        dangerDescription: "Permanently removes this account and its product data. This cannot be undone.",
        activeSubscription: "An active recurring subscription must be cancelled from the provider portal before this account can be deleted.",
        confirmDelete: "Type DELETE to confirm",
        deletePassword: "Current password (when using email sign-in)",
        deleteAccount: "Delete account permanently",
        deletingAccount: "Deleting…",
        deleteFailed: "The account could not be deleted.",
        deletePhrase: "DELETE"
      }
    },
    services: {
      kicker: "Vibe toolkit",
      title: "Services",
      description: "Credits, storage, and AI tools connected to your real account.",
      pricing: "Plans & credit packs",
      pricingDescription: "Prices and provider availability come from the shared Backend.",
      loadingPlans: "Loading plans…",
      plansFailed: "Plans could not be loaded.",
      noPlans: "No active plans are available for this locale.",
      buy: "Continue with {provider}",
      openingCheckout: "Opening checkout…",
      checkoutFailed: "Checkout could not be started.",
      creditsPack: "{count} credits",
      upload: "Image storage",
      uploadDescription: "Upload an image through the authenticated storage service.",
      chooseFile: "Choose image",
      storageProvider: "Storage provider",
      uploadNow: "Upload",
      uploading: "Uploading…",
      uploadFailed: "Upload failed.",
      uploaded: "Upload complete",
      openFile: "Open file",
      aiTools: "AI tools",
      aiDescription: "Each generation is charged against the same credit ledger.",
      aiChat: "AI chat",
      aiImage: "Image generation",
      aiVideo: "Video generation",
      open: "Open"
    }
  },
  docs: {
    home: {
      title: "Vibe Chat Docs",
      subtitle: "Built with Fumadocs",
      description: "A static site project based on Fumadocs, perfect for documentation, blogs, and static pages.",
      cta: {
        docs: "Read Docs",
        blog: "Visit Blog"
      }
    },
    nav: {
      docs: "Docs",
      blog: "Blog"
    },
    blog: {
      title: "Blog",
      description: "Latest articles and updates from the Vibe Chat team",
      allPosts: "All Posts",
      previousPage: "← Previous",
      nextPage: "Next →",
      back: "← Back to Blog",
      noPosts: "No posts yet"
    }
  },
  upload: {
    title: "Upload Files",
    description: "Upload images to cloud storage",
    providerTitle: "Storage Provider",
    providerDescription: "Select your preferred cloud storage provider",
    providers: {
      oss: "Alibaba Cloud OSS",
      ossDescription: "China-optimized storage",
      s3: "Amazon S3",
      s3Description: "Global cloud storage",
      r2: "Cloudflare R2",
      r2Description: "Zero egress fees",
      cos: "Tencent Cloud COS",
      cosDescription: "China cloud storage"
    },
    uploadTitle: "Upload Image",
    uploadDescription: "Drag and drop image or click to browse. Max 1MB.",
    dragDrop: "Drag & drop file here",
    orClick: "Or click to browse (max 1MB)",
    browseFiles: "Browse files",
    clearAll: "Clear all",
    uploadedTitle: "Uploaded Files",
    uploadedDescription: "{count} file(s) uploaded successfully",
    uploading: "Uploading...",
    viewFile: "View",
    uploaded: "Uploaded",
    errors: {
      maxFiles: "You can only upload 1 file",
      imageOnly: "Only image files are allowed",
      fileTooLarge: "File size must be less than 1MB"
    }
  },
  blog: {
    metadata: {
      title: "Vibe Chat - Blog",
      description: "Read the latest articles and updates from the Vibe Chat team.",
      keywords: "blog, articles, updates, Vibe Chat, SaaS"
    },
    title: "Blog",
    subtitle: "Latest articles and updates",
    readMore: "Read More",
    publishedOn: "Published on",
    by: "by",
    noPosts: "No posts yet. Check back soon!",
    backToBlog: "Back to Blog"
  }
} as const; 

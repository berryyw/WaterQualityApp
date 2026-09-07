# Debug Session: send-code-connect-fail
- **Status**: [CLOSED]
- **Issue**: iOS App 点击“发送验证码”后提示 “could not connect to the server”，但本地 SwimService `http://127.0.0.1:3000/api/health` 可正常访问。
- **Debug Server（历史）**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-send-code-connect-fail.ndjson
-
- 备注：iOS 工程内的固定端口调试上报逻辑已清理，当前文档仅保留为历史排查记录。

## Reproduction Steps
1. 启动本地 `SwimService`
2. 启动 iOS 模拟器中的 `SwimWaterQualityApp`
3. 进入注册/验证码流程
4. 输入邮箱并点击“发送验证码”
5. 观察弹窗提示为 “could not connect to the server”

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | App 实际请求的 URL 与预期不一致，或在发起前构造失败 | High | Low | Pending |
| B | 请求已发出，但在 URLSession 传输阶段发生连接级错误 | High | Low | Pending |
| C | 后端已返回响应，但 App 在解码/错误映射阶段丢失了真实报错 | Medium | Low | Pending |
| D | 发送验证码按钮触发路径没有走到 `RemoteAppService.sendVerificationCode` | Medium | Medium | Pending |
| E | 模拟器当前网络环境对 `127.0.0.1:3000` 可达性异常 | Low | Medium | Pending |

## Log Evidence
- 已添加 iOS 端运行时埋点，覆盖：
  - D：`sendVerificationCode` 是否被调用
  - A：请求 URL 构造结果
  - B：`URLSession` 传输层错误
  - C：HTTP 状态码、错误响应体、解码失败

## Verification Conclusion
Pending

# Debug Session: map-search-first-empty
- **Status**: [CLOSED]
- **Issue**: 地图页首次输入内容后点击键盘“搜索”时结果为空，第二次及以后正常。
- **Debug Server（历史）**: http://192.168.0.167:7777/event
- **Log File**: .dbg/trae-debug-log-map-search-first-empty.ndjson
-
- 备注：iOS 工程内的固定 IP 调试上报逻辑已清理，当前文档仅保留为历史排查记录。

## Reproduction Steps
1. 启动 `泳池水质通` 并进入地图页。
2. 首次点击搜索框，输入中文关键词，例如“海淀”。
3. 直接点击键盘上的“搜索”。
4. 观察首轮是否为空结果，再次搜索时是否恢复正常。

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 首次点击键盘“搜索”时，输入法仍处于 markedText 候选态，提交回调拿到空串 | High | Low | Pending |
| B | `textFieldShouldReturn` 首次触发时文本同步顺序错误，`performSearch()` 使用了旧值 | High | Low | Pending |
| C | 首次搜索结果已算出，但 `sheet` 展示早于结果刷新，导致首屏看到空列表 | Med | Med | Pending |
| D | 首次过滤时 `store.filteredVenues(searchText:)` 收到正确文本，但过滤分支或城市数据首次为空 | Med | Med | Pending |

## Log Evidence
- Pending

## Verification Conclusion
- Pending

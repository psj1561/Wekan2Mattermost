# Wekan2Mattermost

Wekan 알림메세지를 가공하여 Mattermost웹훅으로 전달

## Usage

### 깃
[https://github.com/yourusername/yourrepository.git](https://github.com/psj1561/Wekan2Mattermost.git)

### node.js 설치
https://nodejs.org/en

### 라이브러리 설치
```bash
npm install express
npm install dotenv
npm install note-fetch
```

### Make .evn on root
```.env
# 포트번호
PORT=0000

# Mattermost webhook url
 URL = [webhookUrl]
```

### 서버실행
```bash
node app.js
```

### 요청보내기
URL: http://localhost:[PORT번호]/data
<br><br>
METHOD : POST
<br><br>
BODY:
```json
{
    "text": "박성중 created card \"벡틱문법은 JSP에서 사용하지 말것\" to list \"참고\" at swimlane \"프론트 자료실\" at board \"자료실\"\nhttp://localhost/b/TJqnSwAbdSqtDoK2T/board/dFjFF8TX"
}
```

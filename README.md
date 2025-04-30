# Assignment Four

## I had to install request-promise because Render could not deploy with the Google Analytics integration.


# For Assignment 4, I extended our existing API by adding a "watchlist" feature.
## Database/schema changes:
- Added a watchlist field (an array of ObjectId references to movies) to the User model in Users.js and updated our MongoDB collection.
- New routes in server.js (all protected by JWT):
  - GET /watchlist – returns the current user’s populated watchlist
  - POST /watchlist – adds a movie (by movieId) to the user’s watchlist
  - DELETE /watchlist/:movieId – removes a movie from the user’s watchlist

## These enhancements build on Assignment 4's API and power the React front end from Assignment 3, allowing users to manage their personal movie watchlists.


[<img src="https://run.pstmn.io/button.svg" alt="Run In Postman" style="width: 128px; height: 32px;">](https://app.getpostman.com/run-collection/41726845-fee4fd69-e019-4777-a2c1-e3240bbb6590?action=collection%2Ffork&source=rip_markdown&collection-url=entityId%3D41726845-fee4fd69-e019-4777-a2c1-e3240bbb6590%26entityType%3Dcollection%26workspaceId%3D403a8607-442e-4472-8515-d58abd2d2dd5#?env%5Bpimentel-hw4%5D=W3sia2V5IjoidG9rZW4iLCJ2YWx1ZSI6IiIsImVuYWJsZWQiOnRydWUsInR5cGUiOiJkZWZhdWx0Iiwic2Vzc2lvblZhbHVlIjoiSldULi4uIiwiY29tcGxldGVTZXNzaW9uVmFsdWUiOiJKV1QgZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBaQ0k2SWpZM1pqSXdNV0U0Tmprek1XWmlNREEyTkdWbE9URTBOaUlzSW5WelpYSnVZVzFsSWpvaVpXUjFZWEprYjBCbGJXRnBiQzVqYjIwaUxDSnBZWFFpT2pFM05ETTVNVE16T0RsOS5KN2FCRzFDbU1oNW8xQVptd0Q4bzh5LTRnN1JlR3dWc01IS2Uxc2dyemowIiwic2Vzc2lvbkluZGV4IjowfSx7ImtleSI6Im1vdmllSWQiLCJ2YWx1ZSI6IiIsImVuYWJsZWQiOnRydWUsInR5cGUiOiJhbnkiLCJzZXNzaW9uVmFsdWUiOiI2N2Q1NDdiNThkNjI3OTc1NTQ1Yjc5MzgiLCJjb21wbGV0ZVNlc3Npb25WYWx1ZSI6IjY3ZDU0N2I1OGQ2Mjc5NzU1NDViNzkzOCIsInNlc3Npb25JbmRleCI6MX1d)
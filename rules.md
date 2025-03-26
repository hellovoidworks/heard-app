## Node Module Installation Rules
When installing new node modules:
1. Always navigate to the `app` directory first: `cd app`
2. Run npm/yarn commands from within the `app` directory
3. This ensures modules are installed in the correct location and properly tracked in the app's package.json
4. Example:
   ```bash
   cd app
   npm install date-fns-tz
   ``` 
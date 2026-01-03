function createQueryBuilder(table) {
  const state = {
    table,
    action: null,
    payload: null,
    filters: [],
    selectColumns: null,
    maybeSingle: false,
    single: false,
  };

  const builder = {
    select(columns) {
      state.action = state.action || 'select';
      state.selectColumns = columns || '*';
      return builder;
    },
    update(payload) {
      state.action = 'update';
      state.payload = payload;
      return builder;
    },
    insert(payload) {
      state.action = 'insert';
      state.payload = payload;
      return builder;
    },
    eq(column, value) {
      state.filters.push({ column, value });
      return builder;
    },
    maybeSingle() {
      state.maybeSingle = true;
      return builder;
    },
    single() {
      state.single = true;
      return builder;
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
    catch(reject) {
      return execute().catch(reject);
    },
    finally(onFinally) {
      return execute().finally(onFinally);
    },
  };

  async function execute() {
    const getFilterValue = (key) => {
      const match = state.filters.find((f) => f.column === key);
      return match ? match.value : undefined;
    };

    const userId = getFilterValue('user_id');
    const status = getFilterValue('status');

    if (state.table === 'user_subscriptions') {
      if (state.action === 'select') {
        if (status === 'active' && userId) {
          return {
            data: {
              id: 'sub_test_1',
              user_id: userId,
              status: 'active',
              paypal_subscription_id: 'I-TESTPAYPALSUB',
              subscription_plans: {
                name: 'pro',
                display_name: 'Pro',
              },
            },
            error: null,
          };
        }

        return { data: null, error: null };
      }

      if (state.action === 'update') {
        if (status === 'cancelled') {
          return { data: [], error: null };
        }

        if (status === 'active') {
          return {
            data: [
              {
                id: 'sub_test_1',
                user_id: userId,
                status: 'cancelled',
              },
            ],
            error: null,
          };
        }

        return { data: [], error: null };
      }
    }

    if (state.table === 'subscription_events') {
      if (state.action === 'insert') {
        return { data: null, error: null };
      }
    }

    return { data: null, error: null };
  }

  return builder;
}

export const supabase = {
  from(table) {
    return createQueryBuilder(table);
  },
};

export default supabase;

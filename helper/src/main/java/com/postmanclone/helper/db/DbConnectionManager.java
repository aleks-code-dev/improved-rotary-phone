package com.postmanclone.helper.db;

import com.zaxxer.hikari.HikariDataSource;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DbConnectionManager {
    private final Map<String, HikariDataSource> pools = new ConcurrentHashMap<>();

    public void connect(String connId, String url, String user, String password) {
        HikariDataSource existing = pools.get(connId);
        if (existing != null && !existing.isClosed()) {
            existing.close();
        }
        HikariDataSource pool = ConnectionPoolFactory.create(url, user, password);
        pools.put(connId, pool);
    }

    public void disconnect(String connId) {
        HikariDataSource pool = pools.remove(connId);
        if (pool != null && !pool.isClosed()) {
            pool.close();
        }
    }

    public boolean testConnection(String url, String user, String password) {
        try (HikariDataSource pool = ConnectionPoolFactory.create(url, user, password);
             Connection conn = pool.getConnection()) {
            return conn.isValid(5);
        } catch (SQLException e) {
            return false;
        }
    }

    public HikariDataSource getPool(String connId) {
        return pools.get(connId);
    }

    public boolean isConnected(String connId) {
        HikariDataSource pool = pools.get(connId);
        return pool != null && !pool.isClosed();
    }
}

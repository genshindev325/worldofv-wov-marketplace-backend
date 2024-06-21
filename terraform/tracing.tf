# Tracing is currently disabled because the badger backend has a very high 
# memory usage. We need to configure a proper storage backend for trace data 
# such as elasticsearch or cassandra.
# See https://artifacthub.io/packages/helm/jaegertracing/jaeger-operator#creating-a-new-jaeger-with-elasticsearch

# resource "helm_release" "jaeger" {
#   name             = "jaegertracing"
#   namespace        = "tracing"
#   create_namespace = true
#   repository       = "https://jaegertracing.github.io/helm-charts"
#   chart            = "jaeger-operator"
#   version          = "2.38.0"

#   values = [
#     yamlencode({
#       # This is necessary to allow the operator to watch for resources in all
#       # namespaces.
#       rbac = { clusterRole = true }

#       resources = {
#         requests = { cpu = "50m" }
#         limits   = { memory = "128Mi" }
#       }

#       jaeger = {
#         create = true

#         spec = {
#           strategy = "Production"

#           storage = { type = "badger" }

#           # We deploy as a DaemonSet instead of using sidecar containers since 
#           # they mess with Terraform state.
#           agent = { strategy = "DaemonSet" }

#           ingress = { enabled = false }

#           allInOne = {
#             resources = {
#               requests = { cpu = "400m" }
#               limits   = { memory = "5Gi" }
#             }
#           }

#           collector = {
#             maxReplicas = 5
#           }
#         }
#       }
#     })
#   ]
# }

resource "random_password" "jaeger_auth_salt" {
  length = 8
}

resource "htpasswd_password" "jaeger_auth" {
  password = var.admin_password
  salt     = random_password.jaeger_auth_salt.result
}

resource "kubernetes_secret" "jaeger_auth" {
  metadata {
    namespace = "tracing"
    name      = "jaeger-auth"
  }

  data = {
    (var.admin_username) = htpasswd_password.jaeger_auth.bcrypt
  }
}

locals {
  jaeger_api_fqdn = join(".", [terraform.workspace, "jaeger", data.digitalocean_domain.wov_domain.name])
}

resource "kubernetes_ingress_v1" "jaeger_ingress" {
  wait_for_load_balancer = true

  metadata {
    namespace = "tracing"
    name      = "jaeger-ingress"

    annotations = {
      "cert-manager.io/cluster-issuer" = "letsencrypt-issuer"
      # WARNING: during the first deployment auth will need to be disabled
      # for the TLS certificate ACME challenge to work correctly!
      "nginx.ingress.kubernetes.io/auth-type" : "basic"
      "nginx.ingress.kubernetes.io/auth-secret-type" = "auth-map"
      "nginx.ingress.kubernetes.io/auth-secret" : kubernetes_secret.jaeger_auth.metadata[0].name
    }
  }

  spec {
    ingress_class_name = "nginx"

    tls {
      hosts       = [local.jaeger_api_fqdn]
      secret_name = "letsencrypt-tls-secret-jaeger"
    }

    rule {
      host = local.jaeger_api_fqdn

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = "jaegertracing-jaeger-operator-jaeger-query"
              port { number = 16686 }
            }
          }
        }
      }
    }
  }
}

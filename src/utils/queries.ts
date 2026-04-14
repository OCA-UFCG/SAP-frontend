export const GET_ABOUT_PAGE = `
  query GetAboutPage {
    secaoSobreCollection(where: { includeInAboutSap: true }) {
      items {
        sys {
          id
        }
        identifier
        title
        text {
          json
        }
        image {
          url
          title
          width
          height
        }
      }
    }

    cabealhoSeesCollection(limit: 1) {
      items {
        sys {
          id
        }
        title
        description
      }
    }

    partnersCollection {
      items {
        sys {
          id
        }
        name
        image {
          url
          title
          width
          height
        }
      }
    }
  }
`;

export const GET_HOME_PAGE = `
  query GetHomePage {
    bannerCollection(limit: 1) {
      items {
        title
        subtitle
        linkText
        link
        image {
          url
        }
      }
    }

    secaoSobreCollection {
      items {
        identifier
        title
        text {
          json
        }
        image {
          url
          title
        }
        includeInAboutSap
      }
    }

    aboutCollection(limit: 1) {
      items {
        sys {
          id
        }
        title
        text {
          json
        }
        image {
          url
          title
          width
          height
        }
      }
    }

    cabealhoSeesCollection(limit: 1) {
      items {
        sys {
          id
        }
     id
        title
        description
      }
    }

    partnersCollection {
      items {
        sys {
          id
        }
        name
        image {
          url
          title
          width
          height
        }
      } 
    } 
    
  }
`;

export const GET_FOOTER_PAGE = `
  query GetFooterPage {
    footerCollection {
      items {
        sys {
          id
        }
        name
        path
        appears
      }
    }
  }
`;

export const GET_PANEL_LAYER = `
  query GetPanelLayer {
    panelLayerCollection {
      items {
        sys {
          id
        }
        name
        id
        description
        category
        previewMap {
          url
          title
          width
          height
        }
      } 
    }
}
`;
